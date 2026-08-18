export interface User {
  id: string;
  email: string;
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
