import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Power, Store, UserCog } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { pointsOfSaleApi, usersApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { User } from '../types';
import { Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Select, Spinner, useToast } from '../ui/components';

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

export function UsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '', documentSuffix: '', pointOfSaleId: '' });
  const [error, setError] = useState('');
  const [statusUser, setStatusUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmation: '' });
  const [passwordError, setPasswordError] = useState('');
  const [nameUser, setNameUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [pointOfSaleUser, setPointOfSaleUser] = useState<User | null>(null);
  const [pointOfSaleId, setPointOfSaleId] = useState('');
  const [pointOfSaleError, setPointOfSaleError] = useState('');
  const isAdmin = user?.role === 'ADMIN';
  const { data = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: isAdmin });
  const { data: pointsOfSale = [] } = useQuery({ queryKey: ['points-of-sale'], queryFn: pointsOfSaleApi.list, enabled: isAdmin });
  const activePointsOfSale = pointsOfSale.filter((item) => item.isActive);

  const create = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast('Usuario creado');
      setModalOpen(false);
      setForm({ name: '', username: '', password: '', documentSuffix: '', pointOfSaleId: '' });
    },
    onError: (err) => setError(getApiError(err, 'No se pudo crear el usuario')),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersApi.update(id, { isActive }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast(`Usuario ${variables.isActive ? 'activado' : 'desactivado'}`);
      setStatusUser(null);
    },
    onError: (err) => toast(getApiError(err, 'No se pudo cambiar el estado del usuario'), 'error'),
  });

  const changePassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => usersApi.update(id, { password }),
    onSuccess: () => {
      toast('Contrasena actualizada');
      setPasswordUser(null);
      setPasswordForm({ password: '', confirmation: '' });
      setPasswordError('');
    },
    onError: (err) => setPasswordError(getApiError(err, 'No se pudo cambiar la contrasena')),
  });

  const updateName = useMutation({
    mutationFn: ({ id, name: nextName }: { id: string; name: string }) => usersApi.update(id, { name: nextName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast('Nombre actualizado');
      setNameUser(null);
      setName('');
      setNameError('');
    },
    onError: (err) => setNameError(getApiError(err, 'No se pudo actualizar el nombre')),
  });

  const updatePointOfSale = useMutation({
    mutationFn: ({ id, nextPointOfSaleId }: { id: string; nextPointOfSaleId: string }) =>
      usersApi.update(id, { pointOfSaleId: nextPointOfSaleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['points-of-sale'] });
      toast('Punto de venta actualizado');
      setPointOfSaleUser(null);
      setPointOfSaleId('');
      setPointOfSaleError('');
    },
    onError: (err) => setPointOfSaleError(getApiError(err, 'No se pudo actualizar el punto de venta')),
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    await create.mutateAsync(form);
  }

  function openPasswordModal(item: User) {
    setPasswordUser(item);
    setPasswordForm({ password: '', confirmation: '' });
    setPasswordError('');
  }

  function openNameModal(item: User) {
    setNameUser(item);
    setName(item.name);
    setNameError('');
  }

  function openPointOfSaleModal(item: User) {
    setPointOfSaleUser(item);
    setPointOfSaleId(item.pointOfSaleId || '');
    setPointOfSaleError('');
  }

  function submitPointOfSale(event: FormEvent) {
    event.preventDefault();
    setPointOfSaleError('');
    if (!pointOfSaleUser || !pointOfSaleId) return;
    updatePointOfSale.mutate({ id: pointOfSaleUser.id, nextPointOfSaleId: pointOfSaleId });
  }

  function submitName(event: FormEvent) {
    event.preventDefault();
    setNameError('');
    if (!nameUser) return;
    updateName.mutate({ id: nameUser.id, name });
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError('');
    if (passwordForm.password !== passwordForm.confirmation) {
      setPasswordError('Las contrasenas no coinciden');
      return;
    }
    if (!passwordUser) return;
    changePassword.mutate({ id: passwordUser.id, password: passwordForm.password });
  }

  if (!isAdmin) {
    return <EmptyState title="Acceso restringido" subtitle="Solo el administrador puede gestionar usuarios." />;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Usuarios</h1>
          <p className="text-sm text-mute">Usuarios operativos asignados a un punto de venta.</p>
        </div>
        <Button onClick={() => { setError(''); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Nuevo
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-mute">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Punto de venta</th>
                  <th className="px-4 py-3">Sufijo documentos</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserCog className="h-4 w-4 text-brand" />
                        <span className="font-semibold">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{item.username}</td>
                    <td className="px-4 py-3">{item.role === 'ADMIN' ? 'Administrador' : 'Bodega'}</td>
                    <td className="px-4 py-3">{item.pointOfSale?.name || '-'}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{item.documentSuffix}</td>
                    <td className="px-4 py-3">{item.isActive ? 'Activo' : 'Inactivo'}</td>
                    <td className="px-4 py-3">
                      {item.role === 'BODEGA' ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" className="px-3 py-1.5" onClick={() => openPointOfSaleModal(item)}>
                            <Store className="h-4 w-4" /> Punto de venta
                          </Button>
                          <Button variant="secondary" className="px-3 py-1.5" onClick={() => openNameModal(item)}>
                            <Pencil className="h-4 w-4" /> Nombre
                          </Button>
                          <Button variant="secondary" className="px-3 py-1.5" onClick={() => openPasswordModal(item)}>
                            <KeyRound className="h-4 w-4" /> Clave
                          </Button>
                          <Button
                            variant={item.isActive ? 'danger' : 'secondary'}
                            className="px-3 py-1.5"
                            onClick={() => setStatusUser(item)}
                          >
                            <Power className="h-4 w-4" /> {item.isActive ? 'Desactivar' : 'Activar'}
                          </Button>
                        </div>
                      ) : (
                        <div className="text-right text-xs font-medium text-mute">Cuenta protegida</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo usuario de bodega">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nombre">
            <Input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Usuario">
            <Input required minLength={3} maxLength={50} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </Field>
          <Field label="Contrasena">
            <Input required type="password" minLength={6} maxLength={128} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </Field>
          <Field label="Sufijo de documentos" hint="Ejemplo: CALI producira CALI-1, CALI-2, etc.">
            <Input required maxLength={50} value={form.documentSuffix} onChange={(event) => setForm({ ...form, documentSuffix: event.target.value })} />
          </Field>
          <Field label="Punto de venta">
            <Select required value={form.pointOfSaleId} onChange={(event) => setForm({ ...form, pointOfSaleId: event.target.value })}>
              <option value="">Selecciona un punto de venta</option>
              {activePointsOfSale.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.code}</option>)}
            </Select>
          </Field>
          {!activePointsOfSale.length && <p className="rounded-lg bg-gold/10 px-3 py-2 text-sm font-medium text-ink">Debes crear un punto de venta activo antes de crear usuarios.</p>}
          {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || !activePointsOfSale.length}>{create.isPending ? 'Creando...' : 'Crear usuario'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(pointOfSaleUser)}
        onClose={() => { if (!updatePointOfSale.isPending) setPointOfSaleUser(null); }}
        title={`Asignar punto de venta${pointOfSaleUser ? ` - ${pointOfSaleUser.name}` : ''}`}
      >
        <form onSubmit={submitPointOfSale} className="space-y-4">
          <Field label="Punto de venta">
            <Select required autoFocus value={pointOfSaleId} onChange={(event) => setPointOfSaleId(event.target.value)}>
              <option value="">Selecciona un punto de venta</option>
              {activePointsOfSale.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.code}</option>)}
            </Select>
          </Field>
          {pointOfSaleError && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{pointOfSaleError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPointOfSaleUser(null)} disabled={updatePointOfSale.isPending}>Cancelar</Button>
            <Button type="submit" disabled={updatePointOfSale.isPending || !pointOfSaleId}>{updatePointOfSale.isPending ? 'Guardando...' : 'Guardar asignacion'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(nameUser)}
        onClose={() => { if (!updateName.isPending) setNameUser(null); }}
        title={`Editar nombre${nameUser ? ` - ${nameUser.username}` : ''}`}
      >
        <form onSubmit={submitName} className="space-y-4">
          <Field label="Nombre">
            <Input
              required
              autoFocus
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          {nameError && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{nameError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setNameUser(null)} disabled={updateName.isPending}>Cancelar</Button>
            <Button type="submit" disabled={updateName.isPending}>{updateName.isPending ? 'Guardando...' : 'Guardar nombre'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(passwordUser)}
        onClose={() => { if (!changePassword.isPending) setPasswordUser(null); }}
        title={`Cambiar contrasena${passwordUser ? ` - ${passwordUser.name}` : ''}`}
      >
        <form onSubmit={submitPassword} className="space-y-4">
          <Field label="Nueva contrasena" hint="Debe tener al menos 6 caracteres.">
            <Input
              required
              autoFocus
              type="password"
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              value={passwordForm.password}
              onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })}
            />
          </Field>
          <Field label="Confirmar nueva contrasena">
            <Input
              required
              type="password"
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              value={passwordForm.confirmation}
              onChange={(event) => setPasswordForm({ ...passwordForm, confirmation: event.target.value })}
            />
          </Field>
          {passwordError && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{passwordError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPasswordUser(null)} disabled={changePassword.isPending}>Cancelar</Button>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? 'Guardando...' : 'Cambiar contrasena'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(statusUser)}
        title={statusUser?.isActive ? 'Desactivar usuario' : 'Activar usuario'}
        message={statusUser?.isActive
          ? `El usuario ${statusUser.name} perdera el acceso y se cerraran sus sesiones activas.`
          : `El usuario ${statusUser?.name ?? ''} podra volver a ingresar al sistema.`}
        confirmLabel={statusUser?.isActive ? 'Desactivar' : 'Activar'}
        busyLabel={statusUser?.isActive ? 'Desactivando...' : 'Activando...'}
        busy={updateStatus.isPending}
        onCancel={() => { if (!updateStatus.isPending) setStatusUser(null); }}
        onConfirm={() => {
          if (statusUser) updateStatus.mutate({ id: statusUser.id, isActive: !statusUser.isActive });
        }}
      />
    </section>
  );
}
