import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Amount } from './Amount';
import { CategoryBadge } from './CategoryBadge';

type Status = 'good' | 'warning' | 'critical';

// Fixed status palette from the dataviz skill — never themed, always paired
// with an icon + label so the state never rests on color alone.
const STATUS: Record<Status, { color: string; label: string; Icon: typeof CheckCircle2 }> = {
  good: { color: '#0ca30c', label: 'Im Rahmen', Icon: CheckCircle2 },
  warning: { color: '#fab219', label: 'Nahe am Limit', Icon: AlertTriangle },
  critical: { color: '#d03b3b', label: 'Budget überschritten', Icon: AlertCircle },
};

function statusFor(pct: number): Status {
  if (pct >= 100) return 'critical';
  if (pct >= 90) return 'warning';
  return 'good';
}

interface BudgetProgressBarProps {
  categoryId: string;
  categoryName: string;
  budgetCents: number;
  spentCents: number;
}

export function BudgetProgressBar({ categoryId, categoryName, budgetCents, spentCents }: BudgetProgressBarProps) {
  const pct = budgetCents > 0 ? (spentCents / budgetCents) * 100 : 0;
  const status = statusFor(pct);
  const { color, label, Icon } = STATUS[status];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <CategoryBadge categoryId={categoryId} name={categoryName} />
        <span className="text-neutral-500 dark:text-neutral-400">
          <Amount cents={spentCents} /> / <Amount cents={budgetCents} />
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex items-center gap-1.5 text-xs" style={{ color }}>
        <Icon size={14} />
        <span>
          {label} ({pct.toFixed(0)}%)
        </span>
      </div>
    </div>
  );
}
