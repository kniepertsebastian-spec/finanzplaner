import { categoryColor, categoryIcon } from '../lib/categoryStyle';

interface CategoryBadgeProps {
  name: string;
  categoryId: string;
}

export function CategoryBadge({ name, categoryId }: CategoryBadgeProps) {
  const Icon = categoryIcon(name);
  const { bg, text } = categoryColor(categoryId);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${bg} ${text}`}>
      <Icon size={12} />
      {name}
    </span>
  );
}
