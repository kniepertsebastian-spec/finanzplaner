import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
  type ScriptableLineSegmentContext,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { formatCents } from '../../lib/money';
import type { CashflowPoint } from '../../lib/budgetCalc';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// Same balance-line blue as elsewhere on the dashboard; red is reserved for the
// Unterdeckung (shortfall) warning, applied per-segment where the projection dips below zero.
const LINE = { light: '#2a78d6', dark: '#3987e5' };
const WARNING = { light: '#d03b3b', dark: '#e0554f' };

const INK = {
  primary: { light: '#0b0b0b', dark: '#ffffff' },
  muted: { light: '#898781', dark: '#898781' },
  grid: { light: '#e1e0d9', dark: '#2c2c2a' },
};

interface CashflowChartProps {
  points: CashflowPoint[];
  isDark: boolean;
}

export function CashflowChart({ points, isDark }: CashflowChartProps) {
  const mode = isDark ? 'dark' : 'light';
  const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', timeZone: 'UTC' });

  const labels = points.map((p) => dateFormatter.format(p.date));
  const balances = points.map((p) => p.balanceCents);

  const belowZero = (ctx: ScriptableLineSegmentContext) =>
    (ctx.p0.parsed.y ?? 0) < 0 || (ctx.p1.parsed.y ?? 0) < 0 ? WARNING[mode] : undefined;

  const data = {
    labels,
    datasets: [
      {
        label: 'Prognostizierter Kontostand',
        data: balances,
        borderColor: LINE[mode],
        backgroundColor: LINE[mode],
        segment: { borderColor: belowZero },
        borderWidth: 2,
        borderDash: [6, 4], // dashed throughout: the whole line is a forecast, not settled history
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.4,
        fill: {
          target: { value: 0 },
          above: isDark ? 'rgba(57, 135, 229, 0.12)' : 'rgba(42, 120, 214, 0.1)',
          below: isDark ? 'rgba(224, 85, 79, 0.15)' : 'rgba(208, 59, 59, 0.12)',
        },
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `Kontostand: ${formatCents(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Datum', color: INK.muted[mode] },
        ticks: { color: INK.muted[mode], maxRotation: 0, autoSkip: true, autoSkipPadding: 16 },
        grid: { color: INK.grid[mode] },
      },
      y: {
        ticks: {
          color: INK.muted[mode],
          callback: (value) => formatCents(Number(value)),
        },
        grid: { color: INK.grid[mode] },
      },
    },
  };

  return (
    <div role="img" aria-label="Prognostizierter Kontostandsverlauf">
      <Line data={data} options={options} />
    </div>
  );
}
