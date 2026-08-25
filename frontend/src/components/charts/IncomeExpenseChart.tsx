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
  type ScriptableContext,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { formatCents } from '../../lib/money';
import type { Transaction } from '../../lib/api/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// Categorical slots 1 (blue) & 2 (orange) from the dataviz palette — red is
// reserved for the budget-overrun "critical" status elsewhere on this dashboard.
const SERIES = {
  income: { light: '#2a78d6', dark: '#3987e5' },
  expense: { light: '#eb6834', dark: '#d95926' },
};

const INK = {
  primary: { light: '#0b0b0b', dark: '#ffffff' },
  muted: { light: '#898781', dark: '#898781' },
  grid: { light: '#e1e0d9', dark: '#2c2c2a' },
};

// Soft area wash under each line (~10% opacity fading to transparent), per the dataviz skill's
// "area fill = series hue at ~10% opacity, never a saturated block". Scriptable because the
// gradient needs the chart's pixel bounds, which aren't known until after layout.
function areaGradient(hexColor: string) {
  return (context: ScriptableContext<'line'>) => {
    const { chartArea, ctx } = context.chart;
    if (!chartArea) return undefined;
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, `${hexColor}1a`);
    gradient.addColorStop(1, `${hexColor}00`);
    return gradient;
  };
}

interface IncomeExpenseChartProps {
  transactions: Transaction[];
  periodStart: Date;
  daysInPeriod: number;
  isDark: boolean;
}

export function IncomeExpenseChart({ transactions, periodStart, daysInPeriod, isDark }: IncomeExpenseChartProps) {
  const mode = isDark ? 'dark' : 'light';
  const incomeByDay = new Array(daysInPeriod).fill(0);
  const expenseByDay = new Array(daysInPeriod).fill(0);

  // Day-of-period (1-indexed), not calendar day-of-month — a custom financial period (e.g.
  // 23rd -> 22nd) spans two calendar months, so getDate() alone would misplace the second half.
  const periodStartUTC = Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), periodStart.getUTCDate());
  for (const t of transactions) {
    const txDate = new Date(t.date);
    const txUTC = Date.UTC(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
    const day = Math.round((txUTC - periodStartUTC) / (24 * 60 * 60 * 1000)) + 1;
    if (day < 1 || day > daysInPeriod) continue;
    if (t.amount >= 0) {
      incomeByDay[day - 1] += t.amount;
    } else {
      expenseByDay[day - 1] += Math.abs(t.amount);
    }
  }

  const labels = Array.from({ length: daysInPeriod }, (_, i) => String(i + 1));

  const data = {
    labels,
    datasets: [
      {
        label: 'Einnahmen',
        data: incomeByDay,
        borderColor: SERIES.income[mode],
        backgroundColor: areaGradient(SERIES.income[mode]),
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.4,
      },
      {
        label: 'Ausgaben',
        data: expenseByDay,
        borderColor: SERIES.expense[mode],
        backgroundColor: areaGradient(SERIES.expense[mode]),
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.4,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: { color: INK.primary[mode], boxWidth: 12, boxHeight: 12 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCents(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Tag im Zeitraum', color: INK.muted[mode] },
        ticks: { color: INK.muted[mode] },
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
    <div role="img" aria-label="Einnahmen und Ausgaben im Zeitverlauf">
      <Line data={data} options={options} />
    </div>
  );
}
