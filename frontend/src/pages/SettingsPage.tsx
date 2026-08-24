import { useAuth } from '../context/AuthContext';
import { BalanceSettings } from '../components/settings/BalanceSettings';
import { CategoryManager } from '../components/settings/CategoryManager';
import { MonthCycleSettings } from '../components/settings/MonthCycleSettings';
import { PasskeyManager } from '../components/settings/PasskeyManager';
import { RecurringTransactionsPanel } from '../components/settings/RecurringTransactionsPanel';
import { SavingsPotsPanel } from '../components/settings/SavingsPotsPanel';
import { TotpEnrollment } from '../components/settings/TotpEnrollment';

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Einstellungen</h1>
        {user && <p className="text-sm text-neutral-500 dark:text-neutral-400">{user.email}</p>}
      </div>

      <PasskeyManager />
      <TotpEnrollment />
      <BalanceSettings />
      <MonthCycleSettings />
      <CategoryManager />
      <RecurringTransactionsPanel />
      <SavingsPotsPanel />
    </div>
  );
}
