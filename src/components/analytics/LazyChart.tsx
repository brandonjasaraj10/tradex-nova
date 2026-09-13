import { Suspense, useEffect, type ComponentProps } from 'react';
import { lazyWithReload } from '../../lib/lazyWithReload';
import type { Line, Bar, Pie } from 'react-chartjs-2';

/*
  The charts, fetched only once the Analytics page is open.

  Chart.js and react-chartjs-2 are about 140KB of Analytics' 202KB chunk, and
  they were imported at the top of the page, so the whole library downloaded
  before anything on the page could render - including the summary figures at
  the top, which are plain numbers and need no charting at all.

  All three wrappers point at the same module, so they share one chunk and it
  is fetched once however many charts are on screen.

  `import type` above is erased at compile time, so typing the props does not
  drag the library back into this chunk.
*/
const importCharts = () => import('./charts');

const LineLazy = lazyWithReload('ChartLine', () => importCharts().then(m => ({ default: m.Line })));
const BarLazy = lazyWithReload('ChartBar', () => importCharts().then(m => ({ default: m.Bar })));
const PieLazy = lazyWithReload('ChartPie', () => importCharts().then(m => ({ default: m.Pie })));

/*
  Every chart on the page sits inside a fixed h-80 container, so the space is
  already reserved and nothing moves when the real chart arrives. This only
  has to avoid drawing attention to itself while it waits.
*/
function ChartSkeleton() {
  return <div className="w-full h-full" aria-hidden="true" />;
}

/*
  Start the download as soon as any chart mounts, rather than waiting for
  Suspense to trigger. The page shell and the library then arrive in parallel.
*/
function usePrefetchCharts() {
  useEffect(() => {
    importCharts();
  }, []);
}

export function LazyLine(props: ComponentProps<typeof Line>) {
  usePrefetchCharts();
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <LineLazy {...props} />
    </Suspense>
  );
}

export function LazyBar(props: ComponentProps<typeof Bar>) {
  usePrefetchCharts();
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <BarLazy {...props} />
    </Suspense>
  );
}

export function LazyPie(props: ComponentProps<typeof Pie>) {
  usePrefetchCharts();
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <PieLazy {...props} />
    </Suspense>
  );
}
