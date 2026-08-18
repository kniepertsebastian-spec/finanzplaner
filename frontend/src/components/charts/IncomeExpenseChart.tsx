import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { formatCents } from '../../lib/money';
import type { Transaction } from '../../lib/api/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

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

interface IncomeExpenseChartProps {
  transactions: Transaction[];
  daysInMonth: number;
  isDark: boolean;
}

export function IncomeExpenseChart({ transactions, daysInMonth, isDark }: IncomeExpenseChartProps) {
  const mode = isDark ? 'dark' : 'light';
  const incomeByDay = new Array(daysInMonth).fill(0);
  const expenseByDay = new Array(daysInMonth).fill(0);

  for (const t of transactions) {
    const day = new Date(t.date).getDate();
    if (day < 1 || day > daysInMonth) continue;
    if (t.amount >= 0) {
      incomeByDay[day - 1] += t.amount;
    } else {
      expenseByDay[day - 1] += Math.abs(t.amount);
    }
  }

  const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

  const data = {
    labels,
    datasets: [
      {
        label: 'Einnahmen',
        data: incomeByDay,
        borderColor: SERIES.income[mode],
        backgroundColor: SERIES.income[mode],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.2,
      },
      {
        label: 'Ausgaben',
        data: expenseByDay,
        borderColor: SERIES.expense[mode],
        backgroundColor: SERIES.expense[mode],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.2,
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
        title: { display: true, text: 'Tag des Monats', color: INK.muted[mode] },
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
