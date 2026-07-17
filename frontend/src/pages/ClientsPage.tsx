import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, UserSquare2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { clientsApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { Client } from '../types';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Pagination, Select, Spinner, Toggle, useToast } from '../ui/components';

type ClientForm = {
  fullName: string;
  identityDocument: string;
  city: string;
  isGeneral: boolean;
  isActive: boolean;
};

const emptyForm: ClientForm = {
  fullName: '',
  identityDocument: '',
  city: '',
  isGeneral: false,
  isActive: true,
};

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

export function ClientsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [scope, setScope] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [error, setError] = useState('');

  const params = useMemo(
    () => Object.fromEntries(Object.entries({ page, pageSize: 15, search, city, isGeneral: scope }).filter(([, value]) => value !== '' && value !== undefined)),
    [page, search, city, scope],
  );

  const { data, isLoading } = useQuery({ queryKey: ['clients', params], queryFn: () => clientsApi.list(params) });

  const create = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast('Cliente creado');
    },
    onError: (err) => setError(getApiError(err, 'No se pudo guardar el cliente')),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Client> }) => clientsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast('Cliente actualizado');
    },
    onError: (err) => setError(getApiError(err, 'No se pudo actualizar el cliente')),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, city: user?.city || '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setForm({
      fullName: client.fullName,
      identityDocument: client.identityDocument,
      city: client.city || '',
      isGeneral: client.isGeneral,
      isActive: client.isActive,
    });
    setError('');
    setModalOpen(true);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const payload = {
      fullName: form.fullName,
      identityDocument: form.identityDocument,
      city: form.city,
      isGeneral: isAdmin ? form.isGeneral : false,
    };

    try {
      if (editing) await update.mutateAsync({ id: editing.id, payload: { ...payload, isActive: form.isActive } });
      else await create.mutateAsync(payload);
      setModalOpen(false);
    } catch {
      // El mensaje queda en el modal.
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Clientes</h1>
          <p className="text-sm text-mute">Clientes por ciudad o generales visibles para todas las bodegas.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <Field label="Buscar">
            <div className="relative">
              <Input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Nombre o documento" className="pl-9" />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            </div>
          </Field>
          {isAdmin && (
            <Field label="Ciudad">
              <Input value={city} onChange={(event) => { setPage(1); setCity(event.target.value); }} placeholder="Todas" />
            </Field>
          )}
          <Field label="Tipo">
            <Select value={scope} onChange={(event) => { setPage(1); setScope(event.target.value); }}>
              <option value="">Todos</option>
              <option value="true">Generales</option>
              <option value="false">Por ciudad</option>
            </Select>
          </Field>
        </div>
      </Card>

      {isLoading || !data ? (
        <Spinner />
      ) : data.data.length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-mute">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.data.map((client) => (
                  <tr key={client.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserSquare2 className="h-4 w-4 text-brand" />
                        <span className="font-semibold">{client.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{client.identityDocument}</td>
                    <td className="px-4 py-3">{client.city || 'General'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={client.isGeneral ? 'transfer' : 'neutral'}>{client.isGeneral ? 'General' : 'Ciudad'}</Badge>
                    </td>
                    <td className="px-4 py-3">{client.isActive ? 'Activo' : 'Inactivo'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" className="px-2" onClick={() => openEdit(client)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4">
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </div>
        </Card>
      ) : (
        <EmptyState title="Sin clientes" action={<Button onClick={openCreate}>Crear cliente</Button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar cliente' : 'Nuevo cliente'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nombre completo">
            <Input required minLength={2} maxLength={120} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
          </Field>
          <Field label="Documento de identidad">
            <Input required minLength={3} maxLength={40} value={form.identityDocument} onChange={(event) => setForm({ ...form, identityDocument: event.target.value })} />
          </Field>
          <Field label="Ciudad">
            <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} disabled={!isAdmin && Boolean(user?.city)} />
          </Field>
          {isAdmin && (
            <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
              <div>
                <p className="text-sm font-semibold">Cliente general</p>
                <p className="text-xs text-mute">Visible desde cualquier ciudad.</p>
              </div>
              <Toggle checked={form.isGeneral} onChange={(value) => setForm({ ...form, isGeneral: value })} />
            </div>
          )}
          {editing && (
            <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
              <p className="text-sm font-semibold">Activo</p>
              <Toggle checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} />
            </div>
          )}
          {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
