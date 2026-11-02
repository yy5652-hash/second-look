import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa';
const manifest: Partial<ManifestOptions> = { name: 'Second Look — Pause. Check. Choose.', short_name: 'Second Look', description: 'A private second opinion on a suspicious message. No account. No upload.', id: './', start_url: './', scope: './', display: 'standalone', background_color: '#f6f5ef', theme_color: '#234b40', icons: [{src:'icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}] };
// Swapped in by the page only once its service worker is active, so that an installed app cannot
// declare the share target while nothing is there to keep a shared message on the device.
const shareManifest: Plugin = {
  name: 'share-manifest',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'share.webmanifest',
      source: JSON.stringify({
        ...manifest,
        share_target: {
          action: './share',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [{ name: 'image', accept: ['image/*'] }],
          },
        },
      }),
    });
  },
};
export default defineConfig({
  base: './',
  plugins: [preact(), shareManifest, VitePWA({
    strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts',
    injectRegister: false, registerType: 'prompt',
    includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
    manifest,
    injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff2}'], globIgnores: ['ocr/**'], maximumFileSizeToCacheInBytes: 3000000 }
  })],
  test: { include: ['tests/*.test.ts'], environment: 'node' },
});
