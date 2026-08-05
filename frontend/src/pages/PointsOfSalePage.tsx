import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, Store } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { pointsOfSaleApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { PointOfSale } from '../types';
import { Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Spinner, useToast } from '../ui/components';
import { isAdminRole } from '../utils/roles';

const emptyForm = { name: '', code: '', documentPrefix: '', city: '', address: '' };

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

export function PointsOfSalePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = isAdminRole(user?.role);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PointOfSale | null>(null);
  const [statusItem, setStatusItem] = useState<PointOfSale | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['points-of-sale'],
    queryFn: pointsOfSaleApi.list,
    enabled: isAdmin,
  });

  const save = useMutation({
    mutationFn: (payload: typeof form) => editing
      ? pointsOfSaleApi.update(editing.id, payload)
      : pointsOfSaleApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points-of-sale'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast(editing ? 'Punto de venta actualizado' : 'Punto de venta creado');
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setError('');
    },
    onError: (err) => setError(getApiError(err, 'No se pudo guardar el punto de venta')),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => pointsOfSaleApi.update(id, { isActive }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['points-of-sale'] });
      toast(`Punto de venta ${variables.isActive ? 'activado' : 'desactivado'}`);
      setStatusItem(null);
    },
    onError: (err) => toast(getApiError(err, 'No se pudo cambiar el estado'), 'error'),
  });

  function closeModal() {
    if (save.isPending) return;
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setError('');
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  }

  function openEdit(item: PointOfSale) {
    setEditing(item);
    setForm({
      name: item.name,
      code: item.code,
      documentPrefix: item.documentPrefix,
      city: item.city || '',
      address: item.address || '',
    });
    setError('');
    setModalOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    await save.mutateAsync(form);
  }

  if (!isAdmin) {
    return <EmptyState title="Acceso restringido" subtitle="Solo el administrador puede gestionar puntos de venta." />;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Puntos de venta</h1>
          <p className="text-sm text-mute">Administra las sedes operativas a las que se asignan los usuarios.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo</Button>
      </div>

      {isLoading ? <Spinner /> : data.length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-mute">
                <tr>
                  <th className="px-4 py-3">Punto de venta</th>
                  <th className="px-4 py-3">Codigo</th>
                  <th className="px-4 py-3">Prefijo documentos</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3">Direccion</th>
                  <th className="px-4 py-3">Usuarios</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2"><Store className="h-4 w-4 text-brand" /><span className="font-semibold">{item.name}</span></div>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">{item.code}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{item.documentPrefix}</td>
                    <td className="px-4 py-3">{item.city || '-'}</td>
                    <td className="px-4 py-3">{item.address || '-'}</td>
                    <td className="px-4 py-3">{item._count?.users ?? 0}</td>
                    <td className="px-4 py-3">{item.isActive ? 'Activo' : 'Inactivo'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" className="px-3 py-1.5" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /> Editar</Button>
                        <Button variant={item.isActive ? 'danger' : 'secondary'} className="px-3 py-1.5" onClick={() => setStatusItem(item)}>
                          <Power className="h-4 w-4" /> {item.isActive ? 'Desactivar' : 'Activar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : <EmptyState title="Sin puntos de venta" subtitle="Crea el primer punto de venta para poder asignar usuarios." action={<Button onClick={openCreate}>Crear punto de venta</Button>} />}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Editar punto de venta' : 'Nuevo punto de venta'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nombre"><Input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Codigo" hint="Identificador corto, por ejemplo: CALI-NORTE."><Input required maxLength={50} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
          <Field label="Prefijo de documentos" hint="Se comparte entre todos los usuarios de este punto, por ejemplo: CALI.">
            <Input required maxLength={50} value={form.documentPrefix} onChange={(event) => setForm({ ...form, documentPrefix: event.target.value })} />
          </Field>
          <Field label="Ciudad"><Input maxLength={100} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></Field>
          <Field label="Direccion"><Input maxLength={300} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
          {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={save.isPending}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(statusItem)}
        title={statusItem?.isActive ? 'Desactivar punto de venta' : 'Activar punto de venta'}
        message={statusItem?.isActive
          ? `Se desactivara ${statusItem.name}. Primero debes reasignar o desactivar sus usuarios activos.`
          : `${statusItem?.name ?? ''} volvera a estar disponible para asignar usuarios.`}
        confirmLabel={statusItem?.isActive ? 'Desactivar' : 'Activar'}
        busyLabel="Guardando..."
        busy={updateStatus.isPending}
        onCancel={() => { if (!updateStatus.isPending) setStatusItem(null); }}
        onConfirm={() => { if (statusItem) updateStatus.mutate({ id: statusItem.id, isActive: !statusItem.isActive }); }}
      />
    </section>
  );
}
