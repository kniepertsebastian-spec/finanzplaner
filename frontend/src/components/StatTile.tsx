interface StatTileProps {
  label: string;
  value: string;
  valueClassName?: string;
  caption?: string;
}

export function StatTile({ label, value, valueClassName, caption }: StatTileProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueClassName ?? 'text-neutral-900 dark:text-neutral-100'}`}>
        {value}
      </div>
      {caption && <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{caption}</div>}
    </div>
  );
}
