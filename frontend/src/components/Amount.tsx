import clsx from 'clsx';
import { usePrivacyMode } from '../context/PrivacyModeContext';
import { formatCents } from '../lib/money';
import { useCountUp } from '../lib/useCountUp';

interface AmountProps {
  cents: number;
  className?: string;
}

// Renders a Euro amount that's visually masked while Privacy-Mode is on (header toggle in
// AppShell). Uses `filter: blur()` (Tailwind's `blur-sm`), not `backdrop-blur` — it's the number's
// own glyphs that need hiding, not whatever sits behind the element. Also counts up/down to the
// target value instead of jumping straight to it (skipped under `prefers-reduced-motion`).
export function Amount({ cents, className }: AmountProps) {
  const { isPrivate } = usePrivacyMode();
  const displayCents = useCountUp(cents);
  return <span className={clsx(className, isPrivate && 'blur-sm select-none')}>{formatCents(displayCents)}</span>;
}
