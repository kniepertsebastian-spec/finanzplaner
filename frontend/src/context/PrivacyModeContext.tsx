import { createContext, useContext, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'privacyMode';

function getInitialIsPrivate(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'on';
}

interface PrivacyModeContextValue {
  isPrivate: boolean;
  toggle: () => void;
}

const PrivacyModeContext = createContext<PrivacyModeContextValue | null>(null);

export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(getInitialIsPrivate);

  const toggle = () => {
    setIsPrivate((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
      return next;
    });
  };

  return <PrivacyModeContext.Provider value={{ isPrivate, toggle }}>{children}</PrivacyModeContext.Provider>;
}

export function usePrivacyMode(): PrivacyModeContextValue {
  const ctx = useContext(PrivacyModeContext);
  if (!ctx) {
    throw new Error('usePrivacyMode must be used within a PrivacyModeProvider');
  }
  return ctx;
}
