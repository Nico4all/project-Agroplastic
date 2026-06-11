import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken } from '../api/client';
import { User } from '../types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function boot() {
      try {
        const { data } = await api.get<User>('/auth/me');
        setUser(data);
      } catch {
        try {
          const { data } = await api.post('/auth/refresh');
          setAccessToken(data.accessToken);
          setUser(data.user);
        } catch {
          setAccessToken(null);
        }
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password });
      setAccessToken(data.accessToken);
      setUser(data.user);
    },
    register: async (name, email, password) => {
      const { data } = await api.post('/auth/register', { name, email, password });
      setAccessToken(data.accessToken);
      setUser(data.user);
    },
    logout: async () => {
      await api.post('/auth/logout');
      setAccessToken(null);
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
