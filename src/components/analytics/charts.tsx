/*
  Chart.js, its scales and elements, and the three React wrappers Analytics
  uses - all in one module so they land in a single lazily-loaded chunk.

  The registration call has to run before any chart renders, and putting it
  here means it happens exactly once, as a side effect of loading this module.
  It used to sit at the top of Analytics.tsx, which is what pulled the whole
  of Chart.js into that page's chunk whether or not anyone scrolled to a graph.
*/
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export { Line, Bar, Pie };
