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
const LAST_ACTIVE_KEY = 'finanz-pwa:lastActiveAt';

// The auth cookie itself stays valid for days (see JWT_EXPIRES_IN), so on its own it lets a PWA
// pinned to a phone's home screen re-open straight into someone's data with no re-auth at all —
// there's no login screen or OS lock in between, just a tap on the icon. To close that hole we
// track the last moment the app was actually in the foreground and force a fresh
// login+2FA/passkey whenever it's been away longer than this, regardless of whether the cookie
// itself is still valid.
const INACTIVITY_LIMIT_MS = 2 * 60 * 1000;

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

// Read once per check (not written continuously): only updated on an explicit "the app was just
// active/foregrounded" signal below, so the gap between reads reflects real time away, not JS
// timer drift while backgrounded (timers don't run while a PWA is fully closed or suspended).
function readLastActiveAt(): number {
  const raw = localStorage.getItem(LAST_ACTIVE_KEY);
  return raw ? Number(raw) : Date.now();
}

function markActiveNow() {
  localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
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

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort: still lock the app locally even if we're offline or the request fails —
      // leaving stale local state behind would defeat the point of forcing a re-auth.
    }
    setUser(null);
    writeLastUser(null);
    localStorage.removeItem(LAST_ACTIVE_KEY);
    setStatus('anonymous');
  };

  useEffect(() => {
    const idleForMs = Date.now() - readLastActiveAt();
    if (idleForMs > INACTIVITY_LIMIT_MS) {
      // App was away (backgrounded/closed, e.g. reopened via a home-screen icon) longer than the
      // limit — force it through /login (password+2FA or passkey) instead of silently resuming
      // the still-valid session cookie.
      logout();
    } else {
      refresh();
    }
    markActiveNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check on every return to the foreground, not just on initial page load — a PWA that stays
  // resident in memory while "closed" (common on mobile) never re-runs the mount effect above, so
  // without this a long backgrounding wouldn't be caught until the OS actually kills the process.
  useEffect(() => {
    function markActiveAndCheck() {
      if (document.visibilityState !== 'visible') {
        // Freeze the "last seen active" timestamp at the moment it leaves the foreground, so a
        // later resume is measured from here rather than from a possibly much older interaction.
        markActiveNow();
        return;
      }
      const idleForMs = Date.now() - readLastActiveAt();
      markActiveNow();
      if (idleForMs > INACTIVITY_LIMIT_MS) {
        logout();
      }
    }
    document.addEventListener('visibilitychange', markActiveAndCheck);
    return () => document.removeEventListener('visibilitychange', markActiveAndCheck);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string, totpCode?: string) => {
    const me = await authApi.login({ email, password, totpCode });
    setUser(me);
    writeLastUser(me);
    markActiveNow();
    setStatus('authenticated');
  };

  const loginWithPasskey = async () => {
    const options = await authApi.webauthnLoginOptions();
    const assertion = await startAuthentication({ optionsJSON: options });
    await authApi.webauthnLoginVerify(assertion);
    markActiveNow();
    await refresh();
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
