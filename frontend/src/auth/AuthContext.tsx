import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore, UNAUTHORIZED_EVENT } from '../lib/api';
import type { Admin, AuthResponse, Role } from '../lib/types';

interface AuthContextValue {
  admin: Admin | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  setup: (data: { fullName: string; username: string; password: string }) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [admin, setAdmin] = useState<Admin | null>(null);
  // with a stored token we do not know yet if the session is still valid
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get<{ admin: Admin }>('/auth/me')
      .then((data) => setAdmin(data.admin))
      .catch(() => {
        // a refused token is already cleared by the api layer, a network error keeps it
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setAdmin(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const startSession = useCallback((data: AuthResponse) => {
    tokenStore.set(data.token);
    setAdmin(data.admin);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      startSession(await api.post<AuthResponse>('/auth/login', { username, password }));
    },
    [startSession],
  );

  const setup = useCallback(
    async (data: { fullName: string; username: string; password: string }) => {
      startSession(await api.post<AuthResponse>('/auth/setup', data));
    },
    [startSession],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setAdmin(null);
    // nothing of the previous session must stay in memory
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      admin,
      loading,
      login,
      setup,
      logout,
      hasRole: (...roles) => admin !== null && roles.includes(admin.role),
    }),
    [admin, loading, login, setup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}