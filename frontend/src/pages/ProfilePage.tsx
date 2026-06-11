import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, Save, ShieldCheck, UserRound } from 'lucide-react';
import { profileApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { Button, Card, Field, Input, useToast } from '../ui/components';

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

export function ProfilePage() {
  const { user, setCurrentUser } = useAuth();
  const toast = useToast();
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordCode, setPasswordCode] = useState('');
  const [passwordCodeSent, setPasswordCodeSent] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!user) return;
    setProfileForm({ name: user.name, email: user.email });
  }, [user]);

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    setProfileError('');
    setProfileBusy(true);

    try {
      const updated = await profileApi.update(profileForm);
      setCurrentUser(updated);
      toast('Datos personales actualizados');
    } catch (error) {
      setProfileError(getApiError(error, 'No se pudieron actualizar tus datos'));
    } finally {
      setProfileBusy(false);
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('La confirmacion no coincide con la nueva contrasena');
      return;
    }

    setPasswordBusy(true);
    try {
      await profileApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordCodeSent(true);
      toast('Te enviamos un codigo para confirmar el cambio');
    } catch (error) {
      setPasswordError(getApiError(error, 'No se pudo cambiar la contrasena'));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function confirmPasswordCode(event: FormEvent) {
    event.preventDefault();
    setPasswordError('');
    setPasswordBusy(true);

    try {
      await profileApi.confirmPasswordChange({ code: passwordCode });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordCode('');
      setPasswordCodeSent(false);
      toast('Contrasena actualizada');
    } catch (error) {
      setPasswordError(getApiError(error, 'Codigo invalido o expirado'));
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Perfil</h1>
        <p className="text-sm text-mute">Administra tus datos personales y la seguridad de tu cuenta.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand-dark">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">{user?.name}</p>
            <p className="truncate text-sm text-mute">{user?.email}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-2">
            <UserRound className="h-5 w-5 text-brand" />
            <div>
              <h2 className="text-sm font-bold">Datos personales</h2>
              <p className="text-xs text-mute">Estos datos se reflejan en la sesion y sidebar.</p>
            </div>
          </div>

          <form onSubmit={submitProfile} className="space-y-4">
            <Field label="Nombre">
              <Input
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                value={profileForm.name}
                onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
              />
            </Field>
            <Field label="Correo electronico">
              <Input
                required
                type="email"
                autoComplete="email"
                value={profileForm.email}
                onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })}
              />
            </Field>

            {profileError && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{profileError}</p>}

            <Button type="submit" disabled={profileBusy}>
              <Save className="h-4 w-4" /> {profileBusy ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-gold" />
            <div>
              <h2 className="text-sm font-bold">Cambiar contrasena</h2>
              <p className="text-xs text-mute">Debes confirmar tu contrasena actual y luego el codigo enviado a tu correo.</p>
            </div>
          </div>

          {!passwordCodeSent ? (
            <form onSubmit={submitPassword} className="space-y-4">
              <Field label="Contrasena actual">
                <Input
                  required
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                />
              </Field>
              <Field label="Nueva contrasena" hint="Minimo 8 caracteres">
                <Input
                  required
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                />
              </Field>
              <Field label="Confirmar nueva contrasena">
                <Input
                  required
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                />
              </Field>

              {passwordError && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{passwordError}</p>}

              <Button type="submit" disabled={passwordBusy}>
                <KeyRound className="h-4 w-4" /> {passwordBusy ? 'Enviando codigo...' : 'Enviar codigo'}
              </Button>
            </form>
          ) : (
            <form onSubmit={confirmPasswordCode} className="space-y-4">
              <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand-dark">
                Enviamos un codigo a {user?.email}. Vence en 10 minutos.
              </p>
              <Field label="Codigo">
                <Input
                  required
                  minLength={6}
                  maxLength={6}
                  inputMode="numeric"
                  className="text-center text-lg tracking-[0.45em]"
                  value={passwordCode}
                  onChange={(event) => setPasswordCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </Field>

              {passwordError && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{passwordError}</p>}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={passwordBusy}>
                  <KeyRound className="h-4 w-4" /> {passwordBusy ? 'Confirmando...' : 'Confirmar cambio'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPasswordCodeSent(false);
                    setPasswordCode('');
                    setPasswordError('');
                  }}
                >
                  Solicitar otro codigo
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </section>
  );
}
