import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken } from '../api/client';
import { User } from '../types';

type AuthSession = {
  accessToken: string;
  user: User;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  setCurrentUser: (user: User) => void;
  login: (username: string, password: string) => Promise<AuthSession>;
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
          const { data } = await api.post<AuthSession>('/auth/refresh');
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
    setCurrentUser: setUser,
    login: async (username, password) => {
      const { data } = await api.post<AuthSession>('/auth/login', { username, password });
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data;
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
