import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, MailCheck, ShieldCheck } from 'lucide-react';
import { passwordRecoveryApi } from '../api/resources';
import { AuthChallenge, useAuth } from '../state/AuthContext';

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

function AuthShell({ children }: { children: React.ReactNode }) {
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

        <p className="text-xs text-white/35">Caudalia - Finanzas personales</p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-paper px-4 py-8 lg:rounded-l-[2rem]">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card">
          <img src={`${import.meta.env.BASE_URL}brand/caudalia-vertical.png`} alt="Caudalia" className="mx-auto mb-5 h-32 w-auto object-contain" />
          {children}
        </div>
      </section>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      <span className="label">{label}</span>
      <div className="relative">
        <input
          className="input pr-11"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={8}
          autoComplete={autoComplete}
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
  );
}

export function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' }) {
  const { user, login, register, verifyRegistration, resendRegistrationCode } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (mode === 'register' && password !== confirmPassword) {
      setError('La confirmacion no coincide con la contrasena');
      return;
    }

    setLoading(true);
    try {
      const result = mode === 'register' ? await register(name, email, password) : await login(email, password);
      if ('requiresEmailVerification' in result) {
        setChallenge(result);
        setMessage('Te enviamos un codigo de verificacion al correo.');
        return;
      }
      navigate('/');
    } catch (err) {
      setError(getApiError(err, 'No se pudo completar la solicitud'));
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    setError('');
    setLoading(true);
    try {
      await verifyRegistration(challenge.email, code);
      navigate('/');
    } catch (err) {
      setError(getApiError(err, 'Codigo invalido o expirado'));
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (!challenge) return;
    setError('');
    setLoading(true);
    try {
      await resendRegistrationCode(challenge.email);
      setMessage('Te enviamos un nuevo codigo. El anterior queda invalidado.');
    } catch (err) {
      setError(getApiError(err, 'No se pudo reenviar el codigo'));
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordCode(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await passwordRecoveryApi.requestCode({ email });
      setForgotStep('reset');
      setMessage('Si el correo existe, enviamos un codigo de recuperacion.');
    } catch (err) {
      setError(getApiError(err, 'No se pudo solicitar el codigo'));
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmNewPassword) {
      setError('La confirmacion no coincide con la nueva contrasena');
      return;
    }

    setLoading(true);
    try {
      await passwordRecoveryApi.reset({ email, code, newPassword });
      setMessage('Contrasena actualizada. Ya puedes iniciar sesion.');
      setTimeout(() => navigate('/login'), 900);
    } catch (err) {
      setError(getApiError(err, 'No se pudo cambiar la contrasena'));
    } finally {
      setLoading(false);
    }
  }

  if (challenge) {
    return (
      <AuthShell>
        <div className="flex items-center gap-2">
          <MailCheck className="h-5 w-5 text-brand" />
          <p className="text-2xl font-extrabold tracking-tight text-ink">Verifica tu correo</p>
        </div>
        <p className="mt-1 text-sm text-mute">Ingresa el codigo de 6 digitos enviado a {challenge.email}. Vence en 10 minutos.</p>
        <form onSubmit={submitCode} className="mt-6 space-y-4">
          <label>
            <span className="label">Codigo</span>
            <input className="input text-center text-lg tracking-[0.45em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required minLength={6} maxLength={6} inputMode="numeric" />
          </label>
          {message && <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand-dark">{message}</p>}
          {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <button disabled={loading} className="btn-primary w-full">
            {loading ? 'Verificando...' : 'Verificar y entrar'}
          </button>
          <button type="button" disabled={loading} onClick={resendCode} className="btn-soft w-full">
            Solicitar otro codigo
          </button>
        </form>
      </AuthShell>
    );
  }

  if (mode === 'forgot') {
    return (
      <AuthShell>
        <p className="text-2xl font-extrabold tracking-tight text-ink">Recuperar contrasena</p>
        <p className="mt-1 text-sm text-mute">Te enviaremos un codigo temporal para crear una nueva contrasena.</p>

        {forgotStep === 'request' ? (
          <form onSubmit={requestPasswordCode} className="mt-6 space-y-4">
            <label>
              <span className="label">Correo electronico</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
            <button disabled={loading} className="btn-primary w-full">
              {loading ? 'Enviando...' : 'Enviar codigo'}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="mt-6 space-y-4">
            <label>
              <span className="label">Codigo</span>
              <input className="input text-center text-lg tracking-[0.45em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required minLength={6} maxLength={6} inputMode="numeric" />
            </label>
            <PasswordInput label="Nueva contrasena" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
            <PasswordInput label="Confirmar nueva contrasena" value={confirmNewPassword} onChange={setConfirmNewPassword} autoComplete="new-password" />
            {message && <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand-dark">{message}</p>}
            {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
            <button disabled={loading} className="btn-primary w-full">
              {loading ? 'Actualizando...' : 'Cambiar contrasena'}
            </button>
            <button type="button" disabled={loading} onClick={() => setForgotStep('request')} className="btn-soft w-full">
              Solicitar otro codigo
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-mute">
          <Link className="font-semibold text-brand hover:underline" to="/login">
            Volver a iniciar sesion
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="text-2xl font-extrabold tracking-tight text-ink">{mode === 'register' ? 'Crear cuenta' : 'Iniciar sesion'}</p>
      <p className="mt-1 text-sm text-mute">{mode === 'register' ? 'Te enviaremos un codigo para verificar tu correo.' : 'Entra para revisar tu flujo de caja.'}</p>
      <form onSubmit={submitAuth} className="mt-6 space-y-4">
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
        <PasswordInput label="Contrasena" value={password} onChange={setPassword} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
        {mode === 'register' && (
          <PasswordInput label="Confirmar contrasena" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
        )}
        {message && <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand-dark">{message}</p>}
        {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
        <button disabled={loading} className="btn-primary w-full">
          {loading ? 'Procesando...' : mode === 'register' ? 'Crear cuenta' : 'Entrar'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-mute">
        {mode === 'register' ? 'Ya tienes cuenta?' : 'No tienes cuenta?'}{' '}
        <Link className="font-semibold text-brand hover:underline" to={mode === 'register' ? '/login' : '/register'}>
          {mode === 'register' ? 'Inicia sesion' : 'Registrate'}
        </Link>
      </p>
      {mode === 'login' && (
        <p className="mt-2 text-center text-sm">
          <Link className="font-semibold text-brand hover:underline" to="/forgot-password">
            Olvide mi contrasena
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
