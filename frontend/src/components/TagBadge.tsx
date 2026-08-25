import clsx from 'clsx';

interface TagBadgeProps {
  tag: string;
  active?: boolean;
  onClick?: () => void;
}

// Neutral gray pill, deliberately distinct from CategoryBadge's pastel/icon look — a tag isn't a
// category, it's a free-form cross-category label, so it shouldn't visually compete with one.
export function TagBadge({ tag, active, onClick }: TagBadgeProps) {
  const Element = onClick ? 'button' : 'span';
  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        active
          ? 'bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900'
          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
      )}
    >
      #{tag}
    </Element>
  );
}
