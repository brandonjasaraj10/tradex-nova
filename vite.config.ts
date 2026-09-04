import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fs from 'fs';
import path from 'path';

/*
  Source maps exist only to make Sentry readable.

  Without them a production stack trace is `index-DbmNTstH.js:325:6922`, which
  names no file, component or line - a real crash reported by a real user came
  in like that and could not be traced to the code that caused it.

  Gated on the auth token, and for a security reason rather than convenience:
  maps are uploaded to Sentry and then deleted from dist, so they never ship to
  the browser. A build with no token produces no maps at all rather than
  leaving them sitting in dist/ where anyone could fetch them and read the
  entire frontend source.
*/
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const uploadSourceMaps = !!sentryAuthToken;

export default defineConfig({
  build: {
    sourcemap: uploadSourceMaps,
  },
  plugins: [
    react(),
    ...(uploadSourceMaps
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT ?? 'tradex-nova-frontend',
            authToken: sentryAuthToken,
            sourcemaps: {
              // Uploaded, then removed - dist must not carry them to the CDN.
              filesToDeleteAfterUpload: ['./dist/**/*.map'],
            },
            // A failed upload must not fail the deploy. Losing readable stack
            // traces for one release is a nuisance; a site that will not build
            // because Sentry had a bad day is an outage.
            errorHandler: (err) => {
              console.warn('Sentry source map upload failed:', err.message);
            },
          }),
        ]
      : []),
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
          'robots.txt',
          // publicDir is false, so anything in public/ that isn't listed
          // here simply never reaches dist/ and 404s in production.
          'founder-video.mp4',
          'founder-video-poster.jpg'
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