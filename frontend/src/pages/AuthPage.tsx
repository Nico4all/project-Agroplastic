import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') await register(name, email, password);
      else await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'No se pudo iniciar sesion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <img src="/brand/caudalia-vertical.png" alt="Caudalia" className="mx-auto mb-5 h-36 w-auto object-contain" />
        <p className="text-2xl font-black text-ink">{mode === 'register' ? 'Crear cuenta' : 'Iniciar sesion'}</p>
        <p className="mt-1 text-sm text-slate-500">Gestion financiera personal multiusuario.</p>
        <div className="mt-6 space-y-4">
          {mode === 'register' && (
            <label>
              <span className="label">Nombre</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </label>
          )}
          <label>
            <span className="label">Correo</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            <span className="label">Contrasena</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </label>
        </div>
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="btn-primary mt-6 w-full">
          {loading ? 'Procesando...' : mode === 'register' ? 'Registrarme' : 'Entrar'}
        </button>
        <p className="mt-4 text-center text-sm text-slate-500">
          {mode === 'register' ? 'Ya tienes cuenta?' : 'No tienes cuenta?'}{' '}
          <Link className="font-semibold text-ink" to={mode === 'register' ? '/login' : '/register'}>
            {mode === 'register' ? 'Entrar' : 'Registrarte'}
          </Link>
        </p>
      </form>
    </div>
  );
}
