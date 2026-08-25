import { AlertCircle, AlertTriangle, CheckCircle2, Flag, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Amount } from '../components/Amount';
import { BudgetProgressBar } from '../components/BudgetProgressBar';
import { CashflowChart } from '../components/charts/CashflowChart';
import { CategoryDonutChart } from '../components/charts/CategoryDonutChart';
import { IncomeExpenseChart } from '../components/charts/IncomeExpenseChart';
import { SankeyChart } from '../components/charts/SankeyChart';
import { HeroCard } from '../components/HeroCard';
import { Skeleton } from '../components/Skeleton';
import { StatTile } from '../components/StatTile';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/DarkModeContext';
import { budgetsApi } from '../lib/api/budgets';
import { categoriesApi } from '../lib/api/categories';
import { recurringTransactionsApi } from '../lib/api/recurringTransactions';
import { savingsPotsApi } from '../lib/api/savingsPots';
import { transactionsApi } from '../lib/api/transactions';
import type { Budget, Category, RecurringTransaction, SavingsPot, Transaction } from '../lib/api/types';
import { usersApi } from '../lib/api/users';
import {
  availableIncome,
  budgetTypeBreakdown,
  cashflowProjection,
  contractsNeedingCancellationNotice,
  dailyBurnRate,
  daysUntil,
  expensesByCategory,
  firstShortfall,
  moneyFlow,
  monthlyTotals,
  nextIncomeDueDate,
  priceIncreaseRules,
  projectRemainingBudget,
  savingsPotential,
  savingsRate,
  spentForCategory,
  upcomingFixedCosts,
} from '../lib/budgetCalc';
import {
  daysInFinancialPeriod,
  dayOfFinancialPeriod,
  financialPeriodLabel,
  getFinancialPeriod,
  getNextFinancialPeriod,
} from '../lib/financialPeriod';
import { formatCents } from '../lib/money';
import { listWithCache } from '../lib/offlineDb';

// Status colors never stand alone (see BudgetProgressBar) — always paired with an icon + label,
// direction-agnostic wording so it reads correctly for both "at most" (Notwendiges/Wünsche) and
// "at least" (Sparen) targets.
const RULE_STATUS = {
  good: { color: '#0ca30c', label: 'Im Ziel', Icon: CheckCircle2 },
  warning: { color: '#fab219', label: 'Knapp am Ziel', Icon: AlertTriangle },
  critical: { color: '#d03b3b', label: 'Deutliche Abweichung', Icon: AlertCircle },
};

export function DashboardPage() {
  const { isDark } = useDarkMode();
  const { user } = useAuth();
  const monthStartDay = user?.monthStartDay ?? 1;
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [recurring, setRecurring] = useState<RecurringTransaction[] | null>(null);
  const [savingsPots, setSavingsPots] = useState<SavingsPot[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const period = getFinancialPeriod(monthStartDay);

    Promise.all([
      listWithCache('transactions', () =>
        transactionsApi.list({ startDate: period.startISO, endDate: period.endISO }),
      ),
      listWithCache('categories', () => categoriesApi.list()),
      listWithCache('budgets', () => budgetsApi.list({ month: period.startISO })),
      recurringTransactionsApi.list(),
      savingsPotsApi.list(),
      usersApi.getBalance(),
    ])
      .then(([t, c, b, r, pots, bal]) => {
        setTransactions(t);
        setCategories(c);
        setBudgets(b);
        setRecurring(r);
        setSavingsPots(pots);
        setBalance(bal.balance);
      })
      .catch(() => setError('Daten konnten nicht geladen werden.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStartDay]);

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!transactions || !categories || !budgets || !recurring || !savingsPots || balance === null) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const period = getFinancialPeriod(monthStartDay);
  const days = daysInFinancialPeriod(period);
  const elapsed = dayOfFinancialPeriod(monthStartDay);
  const { incomeCents, expenseCents } = monthlyTotals(transactions);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const savingsRatePct = savingsRate(incomeCents, expenseCents);
  const rule503020 = budgetTypeBreakdown(transactions, categories, incomeCents);
  const categoryShares = expensesByCategory(transactions, categories);
  const moneyFlowData = moneyFlow(transactions, categories);

  const totalBudgetCents = budgets.reduce((sum, b) => sum + b.amount, 0);
  const remainingCents = projectRemainingBudget(totalBudgetCents, expenseCents, elapsed, days);

  const nextPeriod = getNextFinancialPeriod(monthStartDay);
  const upcomingFixedCostsCents = upcomingFixedCosts(recurring, nextPeriod.startISO, nextPeriod.endISO);
  const periodLabel = financialPeriodLabel(period);
  const nextPeriodLabel = financialPeriodLabel(nextPeriod);

  const outstandingFixedCostsCents = upcomingFixedCosts(recurring, period.startISO, period.endISO);
  const lockedInPotsCents = savingsPots.reduce((sum, p) => sum + p.amountCents, 0);
  const availableIncomeCents = availableIncome(balance, outstandingFixedCostsCents, lockedInPotsCents);
  const nextIncome = nextIncomeDueDate(recurring);
  const burnRateHorizon = nextIncome ?? period.end;
  const daysUntilNextIncome = daysUntil(burnRateHorizon);
  const dailyBurnRateCents = dailyBurnRate(availableIncomeCents, daysUntilNextIncome);
  const burnRateHorizonLabel = burnRateHorizon.toLocaleDateString('de-DE', { timeZone: 'UTC' });
  const burnRateCaption = nextIncome
    ? `Bis zum nächsten Gehaltseingang am ${burnRateHorizonLabel} (${daysUntilNextIncome} Tage)`
    : `Keine geplante Einnahme gefunden — bis Ende des Zeitraums am ${burnRateHorizonLabel}`;

  // Projection horizon: today through the end of the *current* financial period only. Extending
  // into the next period made the chart span ~2 months right after payday (the whole remaining
  // current period plus the entire next one), which buried the near-term picture the user
  // actually wants right after Gehaltseingang.
  const cashflowHorizonDays = daysUntil(period.end);
  const cashflowPoints = cashflowProjection(balance, recurring, cashflowHorizonDays);
  const shortfall = firstShortfall(cashflowPoints);
  const shortfallLabel = shortfall?.date.toLocaleDateString('de-DE', { timeZone: 'UTC' });

  const cancellationNotices = contractsNeedingCancellationNotice(recurring);
  const increasedRules = priceIncreaseRules(recurring);
  const savings = savingsPotential(transactions, recurring);
  const hasSavingsPotential = [savings.avoidable, savings.inefficient, savings.tooExpensive].some(
    (f) => f.transactionCents > 0 || f.recurringMonthlyCents > 0,
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Zeitraum: {periodLabel}</p>

      <HeroCard
        balanceCents={balance}
        availableIncomeCents={availableIncomeCents}
        availableIncomeCaption={
          lockedInPotsCents > 0
            ? `abzüglich Fixkosten und ${formatCents(lockedInPotsCents)} in Rücklagen`
            : 'abzüglich noch ausstehender Fixkosten'
        }
        dailyBurnRateCents={dailyBurnRateCents}
        burnRateCaption={burnRateCaption}
      />

      {cancellationNotices.length > 0 && (
        <div className="space-y-2 rounded-lg border border-[#fab219]/30 bg-[#fab219]/10 p-4 dark:border-[#fab219]/20">
          <h2 className="text-sm font-medium text-[#9a6b00] dark:text-[#fab219]">
            ⏰ Kündigungsfrist läuft bald ab
          </h2>
          <ul className="space-y-1 text-sm text-[#9a6b00] dark:text-[#fab219]">
            {cancellationNotices.map(({ recurring: r, deadline, contractEndDate }) => (
              <li key={r.id}>
                <span className="font-medium">{r.description}</span>
                {r.contractNumber && ` (${r.contractNumber})`} — spätestens{' '}
                {deadline.toLocaleDateString('de-DE', { timeZone: 'UTC' })} kündigen, sonst verlängert sich der
                Vertrag bis {contractEndDate.toLocaleDateString('de-DE', { timeZone: 'UTC' })}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {increasedRules.length > 0 && (
        <div className="space-y-2 rounded-lg border border-purple-400/30 bg-purple-400/10 p-4 dark:border-purple-400/20">
          <h2 className="text-sm font-medium text-purple-700 dark:text-purple-400">📈 Preiserhöhungen erkannt</h2>
          <ul className="space-y-1 text-sm text-purple-700 dark:text-purple-400">
            {increasedRules.map(({ recurring: r, previousAmount }) => (
              <li key={r.id}>
                <span className="font-medium">{r.description}</span>: <Amount cents={previousAmount} /> →{' '}
                <Amount cents={r.amount} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-purple-700/70 dark:text-purple-400/70">
            Zu prüfen und ggf. zu bestätigen unter Einstellungen → Fixkosten.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Einnahmen (Zeitraum)" cents={incomeCents} valueClassName="text-[#2a78d6]" />
        <StatTile label="Ausgaben (Zeitraum)" cents={expenseCents} valueClassName="text-[#eb6834]" />
        <StatTile
          label="Sparquote"
          value={savingsRatePct !== null ? `${savingsRatePct.toFixed(0)}%` : '–'}
          valueClassName={savingsRatePct !== null && savingsRatePct < 0 ? 'text-[#d03b3b]' : undefined}
          caption="Anteil der Einnahmen, der im Zeitraum nicht ausgegeben wurde"
          sensitive={false}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label={`Fixkosten ${periodLabel}`}
          cents={outstandingFixedCostsCents}
          valueClassName="text-[#eb6834]"
          caption="Summe aller aktiven Fixkosten mit Fälligkeit im laufenden Zeitraum"
        />
        <StatTile
          label={`Fixkosten ${nextPeriodLabel}`}
          cents={upcomingFixedCostsCents}
          valueClassName="text-[#eb6834]"
          caption="Summe aller aktiven, geplanten Fixkosten für den kommenden Zeitraum"
        />
      </div>

      {incomeCents > 0 && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">50/30/20-Regel</h2>
          {(
            [
              { label: 'Notwendiges', cents: rule503020.needsCents, target: 50, direction: 'atMost' as const },
              { label: 'Wünsche', cents: rule503020.wantsCents, target: 30, direction: 'atMost' as const },
              { label: 'Sparen', cents: rule503020.savingsCents, target: 20, direction: 'atLeast' as const },
            ]
          ).map((row) => {
            const pct = (row.cents / incomeCents) * 100;
            const ratio = row.direction === 'atMost' ? pct / row.target : row.target / Math.max(pct, 0.01);
            const status = ratio <= 1 ? RULE_STATUS.good : ratio <= 1.2 ? RULE_STATUS.warning : RULE_STATUS.critical;
            return (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{row.label}</span>
                  <span className="text-neutral-500 dark:text-neutral-400">
                    <Amount cents={row.cents} /> · {pct.toFixed(0)}% (Ziel {row.direction === 'atMost' ? '≤' : '≥'}
                    {row.target}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, pct)}%`, backgroundColor: status.color }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: status.color }}>
                  <status.Icon size={14} />
                  <span>{status.label}</span>
                </div>
              </div>
            );
          })}
          {rule503020.unassignedCents > 0 && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              <Amount cents={rule503020.unassignedCents} /> in nicht zugeordneten Kategorien nicht enthalten — unter
              Einstellungen → Kategorien als Bedarf/Wunsch/Sparen einordnen.
            </p>
          )}
        </div>
      )}

      {hasSavingsPotential && (
        <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Einsparpotenzial</h2>
          {(
            [
              { label: 'Vermeidbar', Icon: Flag, data: savings.avoidable, colorClass: 'text-amber-600 dark:text-amber-400' },
              { label: 'Ineffizient', Icon: TrendingDown, data: savings.inefficient, colorClass: 'text-red-600 dark:text-red-400' },
              { label: 'Zu hoch', Icon: TrendingUp, data: savings.tooExpensive, colorClass: 'text-purple-600 dark:text-purple-400' },
            ]
          )
            .filter((row) => row.data.transactionCents > 0 || row.data.recurringMonthlyCents > 0)
            .map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
                <span className={`flex items-center gap-1.5 font-medium ${row.colorClass}`}>
                  <row.Icon size={14} />
                  {row.label}
                </span>
                <span className="text-right text-neutral-600 dark:text-neutral-300">
                  {row.data.transactionCents > 0 && (
                    <div>
                      <Amount cents={row.data.transactionCents} /> im Zeitraum
                    </div>
                  )}
                  {row.data.recurringMonthlyCents > 0 && (
                    <div>
                      ~<Amount cents={row.data.recurringMonthlyCents} /> / Monat aus Fixkosten
                    </div>
                  )}
                </span>
              </div>
            ))}
        </div>
      )}

      {savingsPots.length > 0 && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Rücklagen</h2>
          {savingsPots.map((pot) => {
            const pct = pot.targetCents ? Math.min(100, (pot.amountCents / pot.targetCents) * 100) : null;
            return (
              <div key={pot.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{pot.name}</span>
                  <span className="text-neutral-500 dark:text-neutral-400">
                    <Amount cents={pot.amountCents} />
                    {pot.targetCents != null && (
                      <>
                        {' / '}
                        <Amount cents={pot.targetCents} />
                      </>
                    )}
                  </span>
                </div>
                {pct !== null && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-[#2a78d6] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Einnahmen &amp; Ausgaben im Zeitverlauf
        </h2>
        <IncomeExpenseChart transactions={transactions} periodStart={period.start} daysInPeriod={days} isDark={isDark} />
      </div>

      {categoryShares.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">Ausgaben nach Kategorie</h2>
          <CategoryDonutChart shares={categoryShares} isDark={isDark} />
        </div>
      )}

      {moneyFlowData.items.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">Geldfluss</h2>
          <SankeyChart data={moneyFlowData} isDark={isDark} />
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">Liquiditätsverlauf</h2>
        <p className="mb-4 text-xs text-neutral-400 dark:text-neutral-500">
          Kontostand-Prognose bis {period.end.toLocaleDateString('de-DE', { timeZone: 'UTC' })} auf Basis aktiver
          wiederkehrender Buchungen — variable Ausgaben sind nicht enthalten.
        </p>
        {shortfall && (
          <p className="mb-4 rounded-md bg-[#d03b3b]/10 px-3 py-2 text-sm text-[#d03b3b] dark:bg-[#e0554f]/10 dark:text-[#e0554f]">
            ⚠ Drohende Unterdeckung: Der Kontostand rutscht laut Prognose am {shortfallLabel} ins Minus (
            <Amount cents={shortfall.balanceCents} />).
          </p>
        )}
        <CashflowChart points={cashflowPoints} isDark={isDark} />
      </div>

      {budgets.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Noch keine Budgets für diesen Monat gesetzt.
        </p>
      ) : (
        <>
          <StatTile
            label="Restbudget-Prognose"
            cents={remainingCents}
            valueClassName={remainingCents < 0 ? 'text-[#d03b3b]' : undefined}
            caption="Lineare Hochrechnung auf Basis der bisherigen Ausgaben in diesem Monat"
          />

          <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Budgets nach Kategorie</h2>
            {budgets.map((b) => (
              <BudgetProgressBar
                key={b.id}
                categoryId={b.categoryId}
                categoryName={categoryById.get(b.categoryId)?.name ?? 'Unbekannt'}
                budgetCents={b.amount}
                spentCents={spentForCategory(transactions, b.categoryId)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
