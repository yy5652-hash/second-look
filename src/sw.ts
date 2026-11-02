/// <reference lib="webworker" />
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision: string | null }[];
};
// A message shared from another app arrives as a POST. It is answered here, so it never reaches
// the host, and held in this worker's memory only until the opened page takes it.
let shared: { text: string; image?: File } | null = null;
self.addEventListener('fetch', (event) => {
  const share = new URL('share', self.registration.scope);
  if (event.request.method !== 'POST' || new URL(event.request.url).href !== share.href) return;
  event.respondWith(
    event.request.formData().then((form) => {
      const parts = ['title', 'text', 'url'].map((key) => form.get(key));
      const strings = parts.filter((part): part is string => typeof part === 'string' && !!part);
      const image = form.get('image');
      shared = {
        text: [...new Set(strings)].join('\n'),
        image: image instanceof File && image.size ? image : undefined,
      };
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    }),
  );
});
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
// Only immutable, versioned OCR program assets are cached. No user content or OCR output.
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith(new URL('ocr/', self.registration.scope).pathname),
  new CacheFirst({
    cacheName: 'second-look-ocr-v7',
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
);
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'TAKE_SHARED') {
    (event.source as Client | null)?.postMessage({ type: 'SHARED', shared });
    shared = null;
  }
});
