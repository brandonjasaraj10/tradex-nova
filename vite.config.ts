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

/*
  Everything in public/ that is allowed to ship.

  publicDir is false, so this list is the only route a file in public/ has
  to the built site - and, since the dev middleware below reads the same
  array, to the dev server too. A file that is not named here does not
  exist as far as either is concerned, and requests for it fall through to
  the SPA and come back as index.html.
*/
const PUBLIC_FILES = [
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
  /*
    Fourteen favicon and app-icon names used to sit here - favicon.ico,
    apple-touch-icon.png, icon-512x512.png and the rest. None of the files
    exist in public/ and nothing references them: index.html points its one
    icon at tradex_logo.png, and site.webmanifest ships "icons": []. They are
    left over from an icon set that predates the favicon fix.

    Removed rather than left in place, because the copier now warns about a
    listed file it cannot find, and fourteen warnings on every build is how a
    warning stops being read.
  */
  'TradeX_AutoSync.mq4',
  'TradeX_AutoSync.mq5',
  'site.webmanifest',
  'sitemap.xml',
  'robots.txt',
  // publicDir is false, so anything in public/ that isn't listed
  // here simply never reaches dist/ and 404s in production.
  'founder-video.mp4',
  'founder-video-poster.jpg',
  /*
    Real screenshots of the running app, used by the landing page's
    hero and product tour. These live in a subdirectory, which the
    copier below had to learn to handle - it used to join the name
    straight onto dist/ and let the failure fall into a silent catch.
  */
  'product/dashboard.jpg',
  'product/journal.jpg',
  'product/calendar.jpg',
  'product/analytics.jpg',
  /*
    The phone crops. Same four screens, shot on a 390px viewport and scrolled
    to the part that screen is about, because a desktop screenshot shrunk to
    phone width is unreadable. See ProductShot.
  */
  'product/dashboard-mobile.jpg',
  'product/journal-mobile.jpg',
  'product/calendar-mobile.jpg',
  'product/analytics-mobile.jpg',
  /*
    Nova answering a real question. Added after the landing page shipped a
    broken image for it: publicDir is false, so a file that is not named in
    this list 404s and comes back as index.html. That is the third time this
    list has caught something, which is the point of the warning below.
  */
  'product/nova.jpg',
  'product/nova-mobile.jpg',
  /* The calendar's psychology view - the one no competitor has. */
  'product/calendar-psych.jpg',
  'product/calendar-psych-mobile.jpg'
];

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
      /*
        publicDir is false on purpose, so Vite serves nothing from public/ and
        only the allowlist below reaches dist. The cost was that the dev server
        showed none of these files either: every one of them 404'd locally and
        came back as the SPA's index.html, so a screenshot or a video looked
        broken on localhost and fine in production. That is the wrong way round
        - local should be the place problems show up first.

        So the same list is now served in dev as well, from the same array.
      */
      name: 'copy-public-files',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = (req.url || '').split('?')[0];
          const name = decodeURIComponent(url.replace(/^\//, ''));
          if (!PUBLIC_FILES.includes(name)) return next();
          const file = path.resolve(__dirname, 'public', name);
          if (!fs.existsSync(file)) return next();
          const ext = path.extname(file).toLowerCase();
          const types: Record<string, string> = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
            '.webmanifest': 'application/manifest+json', '.xml': 'application/xml',
            '.txt': 'text/plain', '.mq4': 'text/plain', '.mq5': 'text/plain',
          };
          res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
          fs.createReadStream(file).pipe(res);
        });
      },
      async closeBundle() {
        const publicDir = path.resolve(__dirname, 'public');
        const outDir = path.resolve(__dirname, 'dist');

        const filesToCopy = PUBLIC_FILES;

        for (const file of filesToCopy) {
          const src = path.join(publicDir, file);
          const dest = path.join(outDir, file);
          try {
            if (!fs.existsSync(src)) {
              console.warn(`[copy-public-files] listed but missing: ${file}`);
              continue;
            }
            /*
              A file in a subdirectory needs its directory to exist first.
              Without this, copyFileSync throws ENOENT and the old silent
              catch turned that into a 404 nobody found until a real visitor
              hit it.
            */
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(src, dest);
          } catch (e) {
            /*
              Still not fatal - a missing image should not fail a deploy -
              but it says so now. The previous version said nothing at all,
              which is how the og:image spent weeks returning HTML.
            */
            console.warn(`[copy-public-files] could not copy ${file}:`, (e as Error).message);
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