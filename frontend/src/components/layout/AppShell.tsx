import { CloudOff, LayoutDashboard, LogOut, Moon, Plus, Settings, Sun, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';
import { countPendingTransactions } from '../../lib/offlineDb';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
    isActive
      ? 'bg-blue-600 text-white'
      : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
  );

export function AppShell() {
  const { logout } = useAuth();
  const { isDark, toggle } = useDarkMode();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      countPendingTransactions().then(setPendingCount);
    };
    refresh();

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'pending-transactions-synced') refresh();
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onMessage);
    }
    window.addEventListener('pending-transactions-changed', refresh);

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMessage);
      }
      window.removeEventListener('pending-transactions-changed', refresh);
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Finanz-PWA</span>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              <LayoutDashboard size={16} />
              Dashboard
            </NavLink>
            <NavLink to="/budgets" className={navLinkClass}>
              <Wallet size={16} />
              Budgets
            </NavLink>
            <NavLink to="/add" className={navLinkClass}>
              <Plus size={16} />
              Hinzufügen
            </NavLink>
            <NavLink to="/settings" className={navLinkClass}>
              <Settings size={16} />
              Einstellungen
            </NavLink>
          </nav>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span
                className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                title="Wird synchronisiert, sobald wieder online"
              >
                <CloudOff size={14} />
                {pendingCount}
              </span>
            )}
            <button
              type="button"
              onClick={toggle}
              aria-label="Farbschema umschalten"
              className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              onClick={() => logout()}
              aria-label="Abmelden"
              className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
