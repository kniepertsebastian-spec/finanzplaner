import {
  CloudOff,
  Eye,
  EyeOff,
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  Moon,
  Plus,
  Receipt,
  Settings,
  Sun,
  Wallet,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';
import { usePrivacyMode } from '../../context/PrivacyModeContext';
import { countPendingTransactions } from '../../lib/offlineDb';

const navItems = [
  { to: '/', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/budgets', end: false, label: 'Budgets', icon: Wallet },
  { to: '/add', end: false, label: 'Hinzufügen', icon: Plus },
  { to: '/transactions', end: false, label: 'Transaktionen', icon: List },
  { to: '/invoices', end: false, label: 'Rechnungen', icon: Receipt },
  { to: '/settings', end: false, label: 'Einstellungen', icon: Settings },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
    isActive
      ? 'bg-blue-600 text-white'
      : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
  );

export function AppShell() {
  const { logout } = useAuth();
  const { isDark, toggle } = useDarkMode();
  const { isPrivate, toggle: togglePrivacy } = usePrivacyMode();
  const [pendingCount, setPendingCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [menuOpen]);

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
      <header
        className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-lg font-semibold text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              <Menu size={20} />
              Finance Menü
            </button>
            {menuOpen && (
              <nav className="absolute left-0 top-full z-20 mt-2 w-56 space-y-0.5 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
                {navItems.map(({ to, end, label, icon: Icon }) => (
                  <NavLink key={to} to={to} end={end} className={navLinkClass}>
                    <Icon size={16} />
                    {label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>
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
              onClick={togglePrivacy}
              aria-label={isPrivate ? 'Blickschutz ausschalten' : 'Blickschutz einschalten'}
              title="Beträge verwischen"
              className={clsx(
                'rounded-md p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                isPrivate ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-600 dark:text-neutral-300',
              )}
            >
              {isPrivate ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
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
