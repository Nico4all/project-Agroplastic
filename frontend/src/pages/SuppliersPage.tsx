import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { suppliersApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { Supplier } from '../types';
import { Button, Card, EmptyState, Field, Input, Modal, Spinner, Toggle, useToast } from '../ui/components';
import { isSuperAdminRole } from '../utils/roles';

function apiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  return (Array.isArray(message) ? message[0] : message) || fallback;
}

export function SuppliersPage() {
  const { user } = useAuth();
  const canEdit = isSuperAdminRole(user?.role);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data = [], isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: suppliersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast('Proveedor creado');
      setModalOpen(false);
    },
    onError: (err) => setError(apiError(err, 'No se pudo crear el proveedor')),
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; isActive?: boolean } }) => suppliersApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['price-list-products'] });
      toast('Proveedor actualizado');
      setModalOpen(false);
    },
    onError: (err) => setError(apiError(err, 'No se pudo actualizar el proveedor')),
  });

  const openForm = (supplier?: Supplier) => {
    setEditing(supplier || null);
    setName(supplier?.name || '');
    setError('');
    setModalOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (editing) await update.mutateAsync({ id: editing.id, payload: { name } });
    else await create.mutateAsync({ name });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Proveedores</h1>
          <p className="text-sm text-mute">Proveedores del catálogo de listas de precios.</p>
        </div>
        {canEdit && <Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Nuevo proveedor</Button>}
      </div>

      {isLoading ? <Spinner /> : data.length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-mute">
                <tr><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Productos</th><th className="px-4 py-3">Estado</th>{canEdit && <th className="px-4 py-3 text-right">Acciones</th>}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.map((supplier) => (
                  <tr key={supplier.id}>
                    <td className="px-4 py-3"><span className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4 text-brand" />{supplier.name}</span></td>
                    <td className="px-4 py-3">{supplier._count?.products ?? 0}</td>
                    <td className="px-4 py-3">{supplier.isActive ? 'Activo' : 'Inactivo'}</td>
                    {canEdit && <td className="px-4 py-3"><div className="flex items-center justify-end gap-3">
                      <Toggle checked={supplier.isActive} onChange={(isActive) => update.mutate({ id: supplier.id, payload: { isActive } })} label="Cambiar estado" />
                      <Button variant="ghost" className="px-2" onClick={() => openForm(supplier)}><Pencil className="h-4 w-4" /></Button>
                    </div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : <EmptyState title="Sin proveedores" action={canEdit ? <Button onClick={() => openForm()}>Crear proveedor</Button> : undefined} />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nombre"><Input required minLength={2} maxLength={191} autoFocus value={name} onChange={(event) => setName(event.target.value)} /></Field>
          {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={create.isPending || update.isPending}>Guardar</Button></div>
        </form>
      </Modal>
    </section>
  );
}
