import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { BudgetsPage } from './pages/BudgetsPage';
import { DashboardPage } from './pages/DashboardPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { LoginPage } from './pages/LoginPage';
import { QuickAddPage } from './pages/QuickAddPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/add" element={<QuickAddPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
