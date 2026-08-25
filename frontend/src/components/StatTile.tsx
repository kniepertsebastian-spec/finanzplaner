import clsx from 'clsx';
import { usePrivacyMode } from '../context/PrivacyModeContext';

interface StatTileProps {
  label: string;
  value: string;
  valueClassName?: string;
  caption?: string;
  // Most StatTiles show a Euro amount and should mask under Privacy-Mode; a few (Sparquote, other
  // percentages) aren't money and opt out.
  sensitive?: boolean;
}

export function StatTile({ label, value, valueClassName, caption, sensitive = true }: StatTileProps) {
  const { isPrivate } = usePrivacyMode();
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
      <div
        className={clsx(
          'mt-1 text-2xl font-semibold',
          valueClassName ?? 'text-neutral-900 dark:text-neutral-100',
          sensitive && isPrivate && 'blur-sm select-none',
        )}
      >
        {value}
      </div>
      {caption && <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{caption}</div>}
    </div>
  );
}
