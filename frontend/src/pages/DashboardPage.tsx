import { useEffect, useState } from 'react';
import { BudgetProgressBar } from '../components/BudgetProgressBar';
import { IncomeExpenseChart } from '../components/charts/IncomeExpenseChart';
import { StatTile } from '../components/StatTile';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/DarkModeContext';
import { budgetsApi } from '../lib/api/budgets';
import { categoriesApi } from '../lib/api/categories';
import { recurringTransactionsApi } from '../lib/api/recurringTransactions';
import { transactionsApi } from '../lib/api/transactions';
import type { Budget, Category, RecurringTransaction, Transaction } from '../lib/api/types';
import { monthlyTotals, projectRemainingBudget, spentForCategory, upcomingFixedCosts } from '../lib/budgetCalc';
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
    ])
      .then(([t, c, b, r]) => {
        setTransactions(t);
        setCategories(c);
        setBudgets(b);
        setRecurring(r);
      })
      .catch(() => setError('Daten konnten nicht geladen werden.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStartDay]);

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!transactions || !categories || !budgets || !recurring) {
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

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Zeitraum: {periodLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Einnahmen (Zeitraum)" value={formatCents(incomeCents)} valueClassName="text-[#2a78d6]" />
        <StatTile label="Ausgaben (Zeitraum)" value={formatCents(expenseCents)} valueClassName="text-[#eb6834]" />
        <StatTile label="Netto (Zeitraum)" value={formatCents(netCents)} />
      </div>

      <StatTile
        label={`Fixkosten ${nextPeriodLabel}`}
        value={formatCents(upcomingFixedCostsCents)}
        valueClassName="text-[#eb6834]"
        caption="Summe aller aktiven, geplanten Fixkosten für den kommenden Zeitraum"
      />

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Einnahmen &amp; Ausgaben im Zeitverlauf
        </h2>
        <IncomeExpenseChart transactions={transactions} periodStart={period.start} daysInPeriod={days} isDark={isDark} />
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
