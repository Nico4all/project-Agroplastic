import { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
