import { createWorker } from 'tesseract.js';
export async function readImage(
  file: File,
  progress: (message: string) => void,
  signal: AbortSignal,
): Promise<{ text: string; note: string }> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/bmp'].includes(file.type))
    throw new Error(
      'Choose a PNG, JPEG, WebP or BMP image. You can also type or paste the message.',
    );
  if (file.size > 10 * 1024 * 1024)
    throw new Error(
      'That image is larger than 10 MB. Crop it to the message, or type the text instead.',
    );
  progress('Opening your image on this device…');
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 20_000_000) {
    bitmap.close();
    throw new Error('That image has too many pixels. Crop it to the message, then try again.');
  }
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const qrWorker = new Worker(new URL('./qr.worker.ts', import.meta.url), { type: 'module' });
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  const abort = () => {
    qrWorker.terminate();
    void worker?.terminate();
  };
  signal.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const qr = await new Promise<string>((resolve, reject) => {
      const limit = setTimeout(() => {
        qrWorker.terminate();
        resolve('');
      }, 10000);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(limit);
          reject(new DOMException('Cancelled', 'AbortError'));
        },
        { once: true },
      );
      qrWorker.onmessage = (e) => {
        clearTimeout(limit);
        resolve(typeof e.data === 'string' ? e.data : '');
      };
      qrWorker.onerror = () => {
        clearTimeout(limit);
        resolve('');
      };
      qrWorker.postMessage({ data: pixels.data, width: pixels.width, height: pixels.height }, [
        pixels.data.buffer,
      ]);
    });
    qrWorker.terminate();
    const qrUrl =
      /^(?:https?|hxxps?):\/\//i.test(qr) || /^[\w.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(qr) ? qr : '';
    progress('Preparing private text recognition…');
    const base = new URL('ocr/v7/', document.baseURI).href;
    const ocr = async () => {
      worker = await createWorker('eng', 1, {
        workerPath: base + 'worker.min.js',
        corePath: base + 'core',
        langPath: base,
        workerBlobURL: false,
        cacheMethod: 'none',
        logger: (m) =>
          progress(
            m.status === 'recognizing text'
              ? `Reading text… ${Math.round(m.progress * 100)}%`
              : 'Loading on-device text reader…',
          ),
      });
      if (signal.aborted) {
        await worker.terminate();
        throw new DOMException('Cancelled', 'AbortError');
      }
      const result = await worker.recognize(canvas);
      return result.data.text.trim();
    };
    try {
      const text = await Promise.race([
        ocr(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), 90000);
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Cancelled', 'AbortError')),
            { once: true },
          );
        }),
      ]);
      return {
        text: [text, qrUrl && !text.includes(qrUrl) ? `QR link: ${qrUrl}` : '']
          .filter(Boolean)
          .join('\n\n'),
        note: qrUrl
          ? 'A QR link was found and added without opening it. Check the recognised text before analysing.'
          : 'Check the recognised text before analysing. Image recognition can miss or misread words.',
      };
    } catch (error) {
      if (signal.aborted) throw error;
      if (qrUrl)
        return {
          text: `QR link: ${qrUrl}`,
          note: 'A QR link was found without opening it. Text recognition did not finish. Add any other words yourself.',
        };
      throw new Error(
        'We could not read this image. If you are offline, the text reader may not be downloaded yet. Try a clearer crop when connected, or type the message below.',
      );
    }
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    qrWorker.terminate();
    await worker?.terminate();
    canvas.width = 0;
    canvas.height = 0;
  }
}
