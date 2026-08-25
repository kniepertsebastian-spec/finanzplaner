import { ArcElement, Chart as ChartJS, Legend, Tooltip, type ChartOptions } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Amount } from '../Amount';
import type { CategoryShare } from '../../lib/budgetCalc';
import { CATEGORY_PALETTE as PALETTE, OTHER_COLOR } from '../../lib/chartPalette';
import { formatCents } from '../../lib/money';

ChartJS.register(ArcElement, Tooltip, Legend);

// Slots 1/2 (blue/orange) double as this app's income/expense identity elsewhere, which is fine:
// identity is scoped per chart, and this chart's own legend disambiguates it.
const MAX_SLICES = 8;

const INK = {
  primary: { light: '#0b0b0b', dark: '#ffffff' },
};

interface CategoryDonutChartProps {
  shares: CategoryShare[];
  isDark: boolean;
}

export function CategoryDonutChart({ shares, isDark }: CategoryDonutChartProps) {
  const mode = isDark ? 'dark' : 'light';
  const totalCents = shares.reduce((sum, s) => sum + s.cents, 0);

  const top = shares.slice(0, MAX_SLICES);
  const otherCents = shares.slice(MAX_SLICES).reduce((sum, s) => sum + s.cents, 0);
  const labels = [...top.map((s) => s.name), ...(otherCents > 0 ? ['Sonstige'] : [])];
  const values = [...top.map((s) => s.cents), ...(otherCents > 0 ? [otherCents] : [])];
  const colors = [
    ...top.map((_, i) => PALETTE[i][mode]),
    ...(otherCents > 0 ? [OTHER_COLOR[mode]] : []),
  ];

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderColor: isDark ? '#1a1a19' : '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: INK.primary[mode], boxWidth: 12, boxHeight: 12, padding: 12 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${formatCents(Number(ctx.parsed))}`,
        },
      },
    },
  };

  return (
    <div className="relative mx-auto max-w-xs" role="img" aria-label="Ausgaben nach Kategorie">
      <Doughnut data={data} options={options} />
      <div className="pointer-events-none absolute inset-x-0 top-[34%] flex -translate-y-1/2 flex-col items-center">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Gesamt</span>
        <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          <Amount cents={totalCents} />
        </span>
      </div>
    </div>
  );
}
