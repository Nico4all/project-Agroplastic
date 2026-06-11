import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
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
    <div className="guilloche grid min-h-screen bg-ink lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow-card">
            <img src={`${import.meta.env.BASE_URL}brand/caudalia-icon.png`} alt="Caudalia" className="h-11 w-11 object-contain" />
          </div>
          <div>
            <p className="text-lg font-extrabold">Caudalia</p>
            <p className="text-sm text-white/55">Control financiero personal</p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70">
            <ShieldCheck className="h-4 w-4 text-gold" /> Datos aislados por usuario
          </p>
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight">
            Tus cuentas, prestamos y movimientos en un solo lugar.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/65">
            Caudalia organiza ingresos, gastos, transferencias, cuentas por cobrar y cuentas por pagar con una experiencia sobria y clara.
          </p>
        </div>

        <p className="text-xs text-white/35">Caudalia · Finanzas personales</p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-paper px-4 py-8 lg:rounded-l-[2rem]">
        <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card">
          <img src={`${import.meta.env.BASE_URL}brand/caudalia-vertical.png`} alt="Caudalia" className="mx-auto mb-5 h-32 w-auto object-contain" />
          <p className="text-2xl font-extrabold tracking-tight text-ink">{mode === 'register' ? 'Crear cuenta' : 'Iniciar sesion'}</p>
          <p className="mt-1 text-sm text-mute">{mode === 'register' ? 'Empieza a llevar tus finanzas en orden.' : 'Entra para revisar tu flujo de caja.'}</p>
          <div className="mt-6 space-y-4">
            {mode === 'register' && (
              <label>
                <span className="label">Nombre</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
              </label>
            )}
            <label>
              <span className="label">Correo electronico</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            <label>
              <span className="label">Contrasena</span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
            </label>
          </div>
          {error && <p className="mt-4 rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <button disabled={loading} className="btn-primary mt-6 w-full">
            {loading ? 'Procesando...' : mode === 'register' ? 'Crear cuenta' : 'Entrar'}
          </button>
          <p className="mt-5 text-center text-sm text-mute">
            {mode === 'register' ? 'Ya tienes cuenta?' : 'No tienes cuenta?'}{' '}
            <Link className="font-semibold text-brand hover:underline" to={mode === 'register' ? '/login' : '/register'}>
              {mode === 'register' ? 'Inicia sesion' : 'Registrate'}
            </Link>
          </p>
        </form>
      </section>
    </div>
  );
}
