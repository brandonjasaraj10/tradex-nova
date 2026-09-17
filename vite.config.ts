import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
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
    rollupOptions: {
      output: {
        /*
          One chunk for the icons, not one per icon.

          lucide-react exports every icon as its own module, so Rollup was
          splitting each one into its own file - 37 chunks of about 1KB each.
          Measured on the live site, that is not free: the landing page asked
          for fifteen of them at once and they took between 350ms and 870ms
          apiece, because the cost of a request at that point is queueing and
          round trips, not bytes. The last one landed 870ms after the first.

          Grouped, they are a single request of a few KB. Deliberately narrow
          - grouping all of node_modules would drag TipTap and Chart.js into
          the first load and undo the route splitting that already works.
        */
        manualChunks(id) {
          if (id.includes('node_modules/lucide-react')) return 'icons';
        },
      },
    },
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
    {
      name: 'copy-public-files',
      apply: 'build',
      async closeBundle() {
        const publicDir = path.resolve(__dirname, 'public');
        const outDir = path.resolve(__dirname, 'dist');

        const filesToCopy = [
          'tradex_logo.png',
          /*
            The share preview image, referenced by og:image and
            twitter:image in index.html. It was missing from this list, so
            the file never reached dist and the URL returned the SPA's HTML
            instead of a PNG - every share of tradexnova.com on Instagram,
            iMessage or Discord showed an empty grey box where the preview
            should be. Seen happening on a real shared link.
          */
          'trade_x_logo.png',
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
          'founder-video-poster.jpg',
          /* The mascot. It must be listed here or it never reaches dist/ and
             404s in production - publicDir is false, so this array is the
             whole contract for what actually ships. */
          'mascot.png'
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