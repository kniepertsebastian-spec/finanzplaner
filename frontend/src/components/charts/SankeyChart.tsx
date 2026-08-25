import type { MoneyFlowData } from '../../lib/budgetCalc';
import { CATEGORY_PALETTE, OTHER_COLOR } from '../../lib/chartPalette';
import { formatCents } from '../../lib/money';
import { Amount } from '../Amount';

const INCOME_COLOR = { light: '#2a78d6', dark: '#3987e5' };
const SAVED_COLOR = { light: '#1baf7a', dark: '#199e70' };
const SAVED_KEY = '__saved__';

const NODE_WIDTH = 12;
const ROW_HEIGHT = 40; // px per item, before proportional scaling — keeps thin flows still visible/labeled
const GAP = 6;
const CHART_WIDTH = 560;

interface SankeyChartProps {
  data: MoneyFlowData;
  isDark: boolean;
}

// Curved ribbon connecting a Y-range on the left edge to a Y-range on the right edge — the
// standard "two cubic béziers, top edge + bottom edge" construction used by Sankey/flow diagrams.
function ribbonPath(x0: number, y0Top: number, y0Bottom: number, x1: number, y1Top: number, y1Bottom: number): string {
  const xm = (x0 + x1) / 2;
  return [
    `M${x0},${y0Top}`,
    `C${xm},${y0Top} ${xm},${y1Top} ${x1},${y1Top}`,
    `L${x1},${y1Bottom}`,
    `C${xm},${y1Bottom} ${xm},${y0Bottom} ${x0},${y0Bottom}`,
    'Z',
  ].join(' ');
}

// Hand-rolled SVG money-flow diagram: all income pooled into a single "Einnahmen" node on the
// left, fanning out into expense categories + "Gespart" (unspent income) on the right. Built by
// hand rather than via a charting library — the only Chart.js-compatible Sankey plugin
// (chartjs-chart-sankey) renders this specific "one source, many destinations" topology with a
// badly broken layout (verified via an isolated test render), and this app's flow shape is simple
// enough (two columns, one always-full-height source node) to compute directly.
export function SankeyChart({ data, isDark }: SankeyChartProps) {
  const mode = isDark ? 'dark' : 'light';
  const { totalIncomeCents, items } = data;
  const total = items.reduce((sum, i) => sum + i.cents, 0) || 1;

  const height = Math.max(160, items.length * ROW_HEIGHT + (items.length - 1) * GAP);
  const usableHeight = height - GAP * (items.length - 1);

  let cursor = 0;
  const rows = items.map((item, index) => {
    const rowHeight = (item.cents / total) * usableHeight;
    const y0 = cursor;
    const y1 = y0 + rowHeight;
    cursor = y1 + GAP;
    const color =
      item.key === SAVED_KEY
        ? SAVED_COLOR[mode]
        : (CATEGORY_PALETTE[index]?.[mode] ?? OTHER_COLOR[mode]);
    return { ...item, y0, y1, color };
  });

  const leftX = 0;
  const rightX = CHART_WIDTH - NODE_WIDTH;
  const textColor = isDark ? '#e5e5e5' : '#262626';

  return (
    <div role="img" aria-label="Geldflussdiagramm: Einnahmen, Ausgaben nach Kategorie und Gespartes">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${height}`} className="h-auto w-full max-w-xl">
        <rect x={leftX} y={0} width={NODE_WIDTH} height={height} fill={INCOME_COLOR[mode]} />
        <text
          x={leftX + NODE_WIDTH + 6}
          y={height / 2}
          dominantBaseline="middle"
          fontSize={12}
          fontWeight={600}
          fill={textColor}
        >
          Einnahmen
        </text>

        {rows.map((row) => (
          <path
            key={row.key}
            d={ribbonPath(leftX + NODE_WIDTH, row.y0, row.y1, rightX, row.y0, row.y1)}
            fill={row.color}
            fillOpacity={0.3}
          >
            <title>
              {row.name}: {formatCents(row.cents)}
            </title>
          </path>
        ))}

        {rows.map((row) => (
          <rect key={row.key} x={rightX} y={row.y0} width={NODE_WIDTH} height={row.y1 - row.y0} fill={row.color} />
        ))}

        {rows.map((row) => (
          <text
            key={row.key}
            x={rightX - 6}
            y={(row.y0 + row.y1) / 2}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={11}
            fill={textColor}
          >
            {row.name}
          </text>
        ))}
      </svg>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Gesamteinnahmen im Zeitraum: <Amount cents={totalIncomeCents} className="font-medium" />
      </p>
    </div>
  );
}
