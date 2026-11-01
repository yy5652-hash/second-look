import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: './',
  plugins: [preact(), VitePWA({
    strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts',
    injectRegister: false, registerType: 'prompt',
    includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
    manifest: { name: 'Second Look — Pause. Check. Choose.', short_name: 'Second Look', description: 'A private second opinion on a suspicious message. No account. No upload.', start_url: './', scope: './', display: 'standalone', background_color: '#f6f5ef', theme_color: '#234b40', icons: [{src:'icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}] },
    injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'], globIgnores: ['ocr/**'], maximumFileSizeToCacheInBytes: 3000000 }
  })],
  test: { include: ['tests/*.test.ts'], environment: 'node' },
});
