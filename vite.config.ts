import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['path', 'util', 'buffer', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    }),
    {
      name: 'copy-public-files',
      apply: 'build',
      async closeBundle() {
        const publicDir = path.resolve(__dirname, 'public');
        const outDir = path.resolve(__dirname, 'dist');

        const filesToCopy = [
          'tradex_logo.png',
          'tradex-icon.svg',
          'tradex-logo.svg',
          'tradex-tab-icon.svg',
          'TradeX_AutoSync.mq4',
          'TradeX_AutoSync.mq5',
          'favicon.ico',
          'favicon.svg',
          'favicon-16x16.png',
          'favicon-16x16.svg',
          'favicon-32x32.png',
          'favicon-32x32.svg',
          'favicon-48x48.png',
          'favicon-64x64.png',
          'apple-touch-icon.png',
          'apple-touch-icon.svg',
          'icon-192x192.png',
          'icon-192x192.svg',
          'icon-512x512.png',
          'icon-512x512.svg',
          'site.webmanifest',
          'sitemap.xml',
          'robots.txt'
        ];

        for (const file of filesToCopy) {
          try {
            const src = path.join(publicDir, file);
            const dest = path.join(outDir, file);
            if (fs.existsSync(src)) {
              fs.copyFileSync(src, dest);
            }
          } catch (e) {
            // Skip files that can't be copied
          }
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ['lucide-react']
  },
  define: {
    global: 'globalThis',
  },
  publicDir: false
});