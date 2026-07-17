import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCog } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { usersApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { Button, Card, EmptyState, Field, Input, Modal, Spinner, useToast } from '../ui/components';

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
  const [form, setForm] = useState({ name: '', username: '', password: '', city: '' });
  const [error, setError] = useState('');
  const isAdmin = user?.role === 'ADMIN';
  const { data = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: isAdmin });

  const create = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast('Usuario creado');
      setModalOpen(false);
      setForm({ name: '', username: '', password: '', city: '' });
    },
    onError: (err) => setError(getApiError(err, 'No se pudo crear el usuario')),
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    await create.mutateAsync(form);
  }

  if (!isAdmin) {
    return <EmptyState title="Acceso restringido" subtitle="Solo el administrador puede crear usuarios." />;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Usuarios</h1>
          <p className="text-sm text-mute">Usuarios de bodega con acceso por usuario y contrasena.</p>
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
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-mute">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3">Estado</th>
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
                    <td className="px-4 py-3">{item.city || '-'}</td>
                    <td className="px-4 py-3">{item.isActive ? 'Activo' : 'Inactivo'}</td>
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
          <Field label="Ciudad">
            <Input required maxLength={100} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
          </Field>
          {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creando...' : 'Crear usuario'}</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
