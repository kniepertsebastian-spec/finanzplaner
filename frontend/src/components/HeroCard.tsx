import { Amount } from './Amount';

interface HeroCardProps {
  balanceCents: number;
  availableIncomeCents: number;
  availableIncomeCaption: string;
  dailyBurnRateCents: number;
  burnRateCaption: string;
}

// Fixed dark mesh-gradient (independent of light/dark theme) so the hero number reads reliably
// white-on-color in both modes — the same treatment a Finanzguru-style hero card uses regardless
// of the surrounding page theme. Built from the app's existing income/expense hues (#2a78d6,
// #eb6834) plus a purple accent already used elsewhere (price-increase badges) rather than
// introducing new brand colors.
const MESH_GRADIENT = [
  'radial-gradient(at 15% 20%, rgba(42, 120, 214, 0.55) 0px, transparent 55%)',
  'radial-gradient(at 85% 10%, rgba(147, 51, 234, 0.45) 0px, transparent 55%)',
  'radial-gradient(at 75% 85%, rgba(235, 104, 52, 0.5) 0px, transparent 55%)',
  'radial-gradient(at 10% 90%, rgba(42, 120, 214, 0.35) 0px, transparent 55%)',
].join(', ');

export function HeroCard({
  balanceCents,
  availableIncomeCents,
  availableIncomeCaption,
  dailyBurnRateCents,
  burnRateCaption,
}: HeroCardProps) {
  return (
    <div
      className="rounded-2xl bg-neutral-900 p-6 text-white shadow-lg"
      style={{ backgroundImage: MESH_GRADIENT }}
    >
      <div className="text-sm font-medium text-white/70">Gesamtsaldo</div>
      <div className="mt-1 text-5xl font-semibold tracking-tight" style={{ fontVariantNumeric: 'proportional-nums' }}>
        <Amount cents={balanceCents} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
        <div>
          <div className="text-xs text-white/60">Frei verfügbar</div>
          <div className={`mt-0.5 text-lg font-semibold ${availableIncomeCents < 0 ? 'text-red-300' : 'text-white'}`}>
            <Amount cents={availableIncomeCents} />
          </div>
          <div className="mt-0.5 text-xs text-white/50">{availableIncomeCaption}</div>
        </div>
        <div>
          <div className="text-xs text-white/60">Tagesbudget</div>
          <div className={`mt-0.5 text-lg font-semibold ${dailyBurnRateCents < 0 ? 'text-red-300' : 'text-white'}`}>
            <Amount cents={dailyBurnRateCents} />
          </div>
          <div className="mt-0.5 text-xs text-white/50">{burnRateCaption}</div>
        </div>
      </div>
    </div>
  );
}
