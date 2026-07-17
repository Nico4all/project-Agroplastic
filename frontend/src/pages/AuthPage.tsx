import { FormEvent, useState } from 'react';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

export function AuthPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(getApiError(err, 'No se pudo iniciar sesion'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-ink lg:grid-cols-[1fr_420px]">
      <section className="hidden min-h-screen flex-col justify-between p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white shadow-card">
            <img src={`${import.meta.env.BASE_URL}brand/caudalia-icon.png`} alt="Caja Bodega" className="h-11 w-11 object-contain" />
          </div>
          <div>
            <p className="text-lg font-extrabold">Caja Bodega</p>
            <p className="text-sm text-white/55">Ingresos, anticipos y caja menor</p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70">
            <ShieldCheck className="h-4 w-4 text-gold" /> Acceso por roles
          </p>
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight">Control operativo de ingresos y egresos.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/65">
            Registra pagos de cartera, anticipos, gastos de bodega y recibos de caja menor en una sola aplicacion.
          </p>
        </div>

        <p className="text-xs text-white/35">Agroplastic - Caja Bodega</p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-paper px-4 py-8 lg:rounded-l-[2rem]">
        <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-card">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white shadow-card">
              <img src={`${import.meta.env.BASE_URL}brand/caudalia-icon.png`} alt="Caja Bodega" className="h-11 w-11 object-contain" />
            </div>
            <div>
              <p className="text-2xl font-extrabold tracking-tight">Iniciar sesion</p>
              <p className="text-sm text-mute">Ingresa con tu usuario asignado.</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label>
              <span className="label">Usuario</span>
              <input
                className="input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                minLength={3}
                maxLength={50}
                autoComplete="username"
              />
            </label>

            <label>
              <span className="label">Contrasena</span>
              <div className="relative">
                <input
                  className="input pr-11"
                  type={visible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  maxLength={128}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-mute transition hover:bg-paper hover:text-ink"
                  aria-label={visible ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  title={visible ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                >
                  {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}

            <button disabled={loading} className="btn-primary w-full">
              <LogIn className="h-4 w-4" /> {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
