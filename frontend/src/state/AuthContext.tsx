import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken } from '../api/client';
import { User } from '../types';

export type AuthChallenge = {
  requiresEmailVerification: true;
  challengeId: string;
  email: string;
  purpose: 'REGISTER' | 'PASSWORD_CHANGE' | 'PASSWORD_RESET';
  expiresAt: string;
};

type AuthSession = {
  accessToken: string;
  user: User;
};

type AuthResult = AuthSession | AuthChallenge;

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  setCurrentUser: (user: User) => void;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  verifyRegistration: (email: string, code: string) => Promise<void>;
  resendRegistrationCode: (email: string) => Promise<void>;
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
    setCurrentUser: setUser,
    login: async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        setUser(data.user);
      }
      return data;
    },
    register: async (name, email, password) => {
      const { data } = await api.post('/auth/register', { name, email, password });
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        setUser(data.user);
      }
      return data;
    },
    verifyRegistration: async (email, code) => {
      const { data } = await api.post('/auth/verify-registration', { email, code });
      setAccessToken(data.accessToken);
      setUser(data.user);
    },
    resendRegistrationCode: async (email) => {
      await api.post('/auth/resend-registration-code', { email });
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
