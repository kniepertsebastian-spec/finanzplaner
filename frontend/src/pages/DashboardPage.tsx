import { useEffect, useState } from 'react';
import { BudgetProgressBar } from '../components/BudgetProgressBar';
import { CashflowChart } from '../components/charts/CashflowChart';
import { IncomeExpenseChart } from '../components/charts/IncomeExpenseChart';
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
  cashflowProjection,
  dailyBurnRate,
  daysUntil,
  firstShortfall,
  monthlyTotals,
  nextIncomeDueDate,
  projectRemainingBudget,
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
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Lädt…</p>;
  }

  const period = getFinancialPeriod(monthStartDay);
  const days = daysInFinancialPeriod(period);
  const elapsed = dayOfFinancialPeriod(monthStartDay);
  const { incomeCents, expenseCents } = monthlyTotals(transactions);
  const netCents = incomeCents - expenseCents;
  const categoryById = new Map(categories.map((c) => [c.id, c]));

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

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Zeitraum: {periodLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Einnahmen (Zeitraum)" value={formatCents(incomeCents)} valueClassName="text-[#2a78d6]" />
        <StatTile label="Ausgaben (Zeitraum)" value={formatCents(expenseCents)} valueClassName="text-[#eb6834]" />
        <StatTile label="Netto (Zeitraum)" value={formatCents(netCents)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label="Frei verfügbar"
          value={formatCents(availableIncomeCents)}
          valueClassName={availableIncomeCents < 0 ? 'text-[#d03b3b]' : undefined}
          caption={
            lockedInPotsCents > 0
              ? `Gesamtsaldo abzüglich ausstehender Fixkosten und ${formatCents(lockedInPotsCents)} in Rücklagen`
              : 'Gesamtsaldo abzüglich noch ausstehender Fixkosten in diesem Zeitraum'
          }
        />
        <StatTile
          label="Tagesbudget"
          value={formatCents(dailyBurnRateCents)}
          valueClassName={dailyBurnRateCents < 0 ? 'text-[#d03b3b]' : undefined}
          caption={burnRateCaption}
        />
      </div>

      <StatTile
        label={`Fixkosten ${nextPeriodLabel}`}
        value={formatCents(upcomingFixedCostsCents)}
        valueClassName="text-[#eb6834]"
        caption="Summe aller aktiven, geplanten Fixkosten für den kommenden Zeitraum"
      />

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
                    {formatCents(pot.amountCents)}
                    {pot.targetCents != null && ` / ${formatCents(pot.targetCents)}`}
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

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">Liquiditätsverlauf</h2>
        <p className="mb-4 text-xs text-neutral-400 dark:text-neutral-500">
          Kontostand-Prognose bis {period.end.toLocaleDateString('de-DE', { timeZone: 'UTC' })} auf Basis aktiver
          wiederkehrender Buchungen — variable Ausgaben sind nicht enthalten.
        </p>
        {shortfall && (
          <p className="mb-4 rounded-md bg-[#d03b3b]/10 px-3 py-2 text-sm text-[#d03b3b] dark:bg-[#e0554f]/10 dark:text-[#e0554f]">
            ⚠ Drohende Unterdeckung: Der Kontostand rutscht laut Prognose am {shortfallLabel} ins Minus (
            {formatCents(shortfall.balanceCents)}).
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
            value={formatCents(remainingCents)}
            valueClassName={remainingCents < 0 ? 'text-[#d03b3b]' : undefined}
            caption="Lineare Hochrechnung auf Basis der bisherigen Ausgaben in diesem Monat"
          />

          <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Budgets nach Kategorie</h2>
            {budgets.map((b) => (
              <BudgetProgressBar
                key={b.id}
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
