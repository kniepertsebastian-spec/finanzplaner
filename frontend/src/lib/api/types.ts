export interface User {
  id: string;
  email: string;
  totpEnabled: boolean;
  monthStartDay: number; // 1-31; day the user's financial month begins
  startingBalance: number; // Cents; opening balance before any tracked transactions existed
}

export interface Authenticator {
  id: string;
  deviceName: string | null;
  credentialDeviceType: string | null;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export interface Invoice {
  id: string;
  filename: string;
  mimeType: string;
  size: number; // bytes
  important: boolean;
  uploadedAt: string;
  userId: string;
}

export interface RecurringTransaction {
  id: string;
  amount: number; // cents; positive = income, negative = expense
  description: string;
  nextDueDate: string; // ISO date of the next posting
  intervalMonths: number; // 1 = monthly, 3 = quarterly, 12 = yearly, ...
  active: boolean;
  avoidable: boolean;
  inefficient: boolean;
  tooExpensive: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  categoryId: string;
  contractNumber: string | null;
  contractEndDate: string | null; // minimum term end date; contract auto-renews if not cancelled in time
  cancellationPeriodDays: number | null; // days' notice required before contractEndDate to cancel
}

export interface SavingsPot {
  id: string;
  name: string;
  amountCents: number; // cents currently set aside; locked away from "Frei verfügbar"
  targetCents: number | null; // optional savings goal, cents
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface Category {
  id: string;
  name: string;
  userId: string;
}

export interface Transaction {
  id: string;
  amount: number; // cents; positive = income, negative = expense
  description: string;
  date: string;
  avoidable: boolean;
  inefficient: boolean;
  tooExpensive: boolean;
  userId: string;
  categoryId: string;
}

export interface Budget {
  id: string;
  amount: number; // cents
  month: string; // ISO date, first-of-month
  userId: string;
  categoryId: string;
}
