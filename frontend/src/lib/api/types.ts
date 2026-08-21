export interface User {
  id: string;
  email: string;
  totpEnabled: boolean;
}

export interface Authenticator {
  id: string;
  deviceName: string | null;
  credentialDeviceType: string | null;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export interface RecurringTransaction {
  id: string;
  amount: number; // cents; positive = income, negative = expense
  description: string;
  dayOfMonth: number; // 1-31
  active: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  categoryId: string;
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
