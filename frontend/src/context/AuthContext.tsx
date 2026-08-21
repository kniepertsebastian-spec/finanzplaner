import { startAuthentication } from '@simplewebauthn/browser';
import { isAxiosError } from 'axios';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../lib/api/auth';
import type { User } from '../lib/api/types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const LAST_USER_KEY = 'finanz-pwa:lastUser';

function readLastUser(): User | null {
  const raw = localStorage.getItem(LAST_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function writeLastUser(user: User | null) {
  if (user) {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LAST_USER_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  const refresh = async () => {
    try {
      const me = await authApi.me();
      setUser(me);
      writeLastUser(me);
      setStatus('authenticated');
    } catch (err) {
      // A network failure (no response reached) doesn't mean the session is
      // invalid — it means we're offline. Assume the last known session is
      // still good rather than bouncing an offline user to /login.
      if (isAxiosError(err) && !err.response) {
        const lastUser = readLastUser();
        if (lastUser) {
          setUser(lastUser);
          setStatus('authenticated');
          return;
        }
      }
      setUser(null);
      writeLastUser(null);
      setStatus('anonymous');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (email: string, password: string, totpCode?: string) => {
    const me = await authApi.login({ email, password, totpCode });
    setUser(me);
    writeLastUser(me);
    setStatus('authenticated');
  };

  const loginWithPasskey = async () => {
    const options = await authApi.webauthnLoginOptions();
    const assertion = await startAuthentication({ optionsJSON: options });
    await authApi.webauthnLoginVerify(assertion);
    await refresh();
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    writeLastUser(null);
    setStatus('anonymous');
  };

  return (
    <AuthContext.Provider value={{ status, user, login, loginWithPasskey, logout, refreshUser: refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
