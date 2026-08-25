import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
}

// Shimmering placeholder block for loading states — a horizontal gradient sweep (`animate-shimmer`,
// defined in index.css) rather than Tailwind's built-in `animate-pulse` opacity fade, per the
// roadmap's "Skeleton-Loader mit Shimmer-Effekt" spec.
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-shimmer rounded-md bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:800px_100%] dark:from-neutral-800 dark:via-neutral-700 dark:to-neutral-800',
        className,
      )}
    />
  );
}

// Generic stand-in for a settings-style list (used where a full bespoke skeleton isn't worth the
// extra code — a form/table page gets its own shaped skeleton instead).
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
