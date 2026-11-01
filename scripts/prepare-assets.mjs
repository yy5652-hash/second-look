import { mkdir, copyFile, rm, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
// tesseract.js 7 loads exactly one core file per device, chosen in
// src/worker-script/browser/getCore.js. The app starts the worker in LSTM-only mode
// (createWorker('eng', 1)), so only the three -lstm builds can ever be requested, one for each
// of: relaxed SIMD, plain SIMD, and no SIMD. Each .wasm.js already embeds its WebAssembly
// binary, so the separate .wasm files and the legacy-engine builds are never fetched.
const cores = [
  'tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js',
];
await rm('public/ocr', { recursive: true, force: true });
await mkdir('public/ocr/v7/core', { recursive: true });
await copyFile('node_modules/tesseract.js/dist/worker.min.js', 'public/ocr/v7/worker.min.js');
for (const name of cores)
  await copyFile(`node_modules/tesseract.js-core/${name}`, `public/ocr/v7/core/${name}`);
await copyFile(
  'node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz',
  'public/ocr/v7/eng.traineddata.gz',
);
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="108" fill="#234b40"/><g fill="none" stroke="#f6f5ef" stroke-width="25" stroke-linecap="round"><path d="M128 256s48-82 128-82 128 82 128 82-48 82-128 82-128-82-128-82Z"/><circle cx="256" cy="256" r="35"/><path d="m350 135 22-22M140 377l22-22"/></g></svg>';
await writeFile('public/icon.svg', svg);
for (const [size, name] of [
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
  [180, 'apple-touch-icon.png'],
])
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/${name}`);
console.log('Local OCR worker, the three LSTM cores, English model and install icons ready.');
