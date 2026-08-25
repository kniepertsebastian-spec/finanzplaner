import {
  Banknote,
  Car,
  Dumbbell,
  Film,
  GraduationCap,
  Heart,
  Home,
  PiggyBank,
  Plane,
  Shirt,
  ShoppingCart,
  Tag,
  Utensils,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';

// Keyword -> icon for common German budgeting category names (same "match by substring" idea as
// voiceParse.ts's matchCategoryId, just inverted: name -> icon instead of transcript -> category).
// Order matters — first match wins. Falls back to a generic tag icon for anything unrecognized,
// since a wrong-but-confident icon (e.g. a shopping cart on "Yoga") would look more broken than a
// neutral one.
const ICON_KEYWORDS: [RegExp, LucideIcon][] = [
  [/miete|wohnen|haus/i, Home],
  [/lebensmittel|supermarkt|einkauf/i, ShoppingCart],
  [/auto|transport|tanken|bahn|verkehr|kfz/i, Car],
  [/strom|energie|gas|heizung/i, Zap],
  [/internet|handy|telefon|mobilfunk/i, Wifi],
  [/versicherung|gesundheit|arzt/i, Heart],
  [/restaurant|essen|café|kaffee|imbiss/i, Utensils],
  [/freizeit|kino|streaming|unterhaltung|hobby/i, Film],
  [/urlaub|reise|flug/i, Plane],
  [/sport|fitness|gym/i, Dumbbell],
  [/bildung|kurs|schule|uni/i, GraduationCap],
  [/gehalt|einkommen|lohn/i, Wallet],
  [/sparen|rücklage/i, PiggyBank],
  [/kleidung|mode/i, Shirt],
  [/bank|gebühr|kredit/i, Banknote],
];

export function categoryIcon(name: string): LucideIcon {
  return ICON_KEYWORDS.find(([pattern]) => pattern.test(name))?.[1] ?? Tag;
}

interface PastelColor {
  bg: string;
  text: string;
}

// Fixed, validated pairs (Tailwind's -100/-700 light steps, -900/40 opacity + -300 dark steps) —
// picked for pastel-but-legible contrast in both themes, not tied to any particular category
// meaning (unlike the app's income/expense/status colors elsewhere, a badge's color here is pure
// visual variety, not an encoded signal).
const PASTEL_COLORS: PastelColor[] = [
  { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300' },
  { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300' },
  { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-700 dark:text-teal-300' },
  { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300' },
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Deterministic (same category always gets the same color across reloads/sessions) without
// needing a stored color field on Category — derived from the id, which is stable.
export function categoryColor(categoryId: string): PastelColor {
  return PASTEL_COLORS[hashString(categoryId) % PASTEL_COLORS.length];
}
