import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Pencil, Plus, Search } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { pointsOfSaleApi, productsApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { Product } from '../types';
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Toggle, useToast } from '../ui/components';
import { isAdminRole } from '../utils/roles';

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

export function ProductsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = isAdminRole(user?.role);
  const [pointOfSaleId, setPointOfSaleId] = useState(user?.pointOfSaleId || '');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const { data: points = [] } = useQuery({ queryKey: ['points-of-sale'], queryFn: pointsOfSaleApi.list, enabled: isAdmin });

  useEffect(() => {
    if (isAdmin && !pointOfSaleId && points.length) setPointOfSaleId(points[0].id);
  }, [isAdmin, pointOfSaleId, points]);

  const params = useMemo(
    () => ({ ...(search ? { search } : {}), ...(pointOfSaleId ? { pointOfSaleId } : {}) }),
    [search, pointOfSaleId],
  );
  const { data = [], isLoading } = useQuery({
    queryKey: ['products', params],
    queryFn: () => productsApi.list(params),
    enabled: Boolean(pointOfSaleId),
  });
  const pointName = isAdmin ? points.find((point) => point.id === pointOfSaleId)?.name : user?.pointOfSale?.name;

  const create = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast('Producto agregado al punto de venta');
      setDescription('');
      setModalOpen(false);
    },
    onError: (err) => setError(getApiError(err, 'No se pudo crear el producto')),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { pointOfSaleId: string; description?: string; isActive?: boolean } }) =>
      productsApi.update(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast(variables.payload.isActive === undefined ? 'Producto actualizado' : `Producto ${variables.payload.isActive ? 'activado' : 'desactivado'}`);
      if (variables.payload.description !== undefined) setModalOpen(false);
    },
    onError: (err) => {
      const message = getApiError(err, 'No se pudo actualizar el producto');
      if (modalOpen) setError(message);
      else toast(message, 'error');
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDescription('');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setDescription(product.description);
    setError('');
    setModalOpen(true);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!pointOfSaleId) return setError('Selecciona un punto de venta');
    if (editing) await update.mutateAsync({ id: editing.id, payload: { pointOfSaleId, description } });
    else await create.mutateAsync({ description, pointOfSaleId });
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Productos de pedidos</h1>
          <p className="text-sm text-mute">Catálogo y disponibilidad separados por punto de venta.</p>
        </div>
        {isAdmin && <Button onClick={openCreate} disabled={!pointOfSaleId}><Plus className="h-4 w-4" /> Nuevo</Button>}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2">
          {isAdmin ? (
            <Field label="Punto de venta">
              <Select value={pointOfSaleId} onChange={(event) => setPointOfSaleId(event.target.value)}>
                <option value="">Selecciona</option>
                {points.filter((point) => point.isActive).map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}
              </Select>
            </Field>
          ) : <Field label="Punto de venta"><Input disabled value={pointName || 'Sin asignar'} /></Field>}
          <Field label="Buscar">
            <div className="relative">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Descripción" className="pl-9" />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            </div>
          </Field>
        </div>
      </Card>

      {!pointOfSaleId ? <EmptyState title="Selecciona un punto de venta" /> : isLoading ? (
        <Spinner />
      ) : data.length ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line bg-brand-soft/40 px-4 py-3 text-sm">Inventario de <strong>{pointName}</strong></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-mute"><tr><th className="px-4 py-3">Descripción</th><th className="px-4 py-3 text-right">Existencia</th><th className="px-4 py-3">Estado</th>{isAdmin && <th className="px-4 py-3 text-right">Acciones</th>}</tr></thead>
              <tbody className="divide-y divide-line">{data.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-brand" /><span className="font-semibold">{product.description}</span></div></td>
                  <td className={`px-4 py-3 text-right font-bold ${product.quantity <= 0 ? 'text-expense' : 'text-brand-dark'}`}>{product.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</td>
                  <td className="px-4 py-3">{product.isActive ? 'Activo' : 'Inactivo'}</td>
                  {isAdmin && <td className="px-4 py-3"><div className="flex items-center justify-end gap-3"><Toggle checked={product.isActive} label={`${product.isActive ? 'Desactivar' : 'Activar'} ${product.description}`} onChange={(isActive) => update.mutate({ id: product.id, payload: { pointOfSaleId, isActive } })} /><Button variant="ghost" className="px-2" title="Editar" onClick={() => openEdit(product)}><Pencil className="h-4 w-4" /></Button></div></td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      ) : <EmptyState title="Sin productos en este punto de venta" action={isAdmin ? <Button onClick={openCreate}>Agregar producto</Button> : undefined} />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar producto' : 'Agregar producto'}>
        <form onSubmit={submit} className="space-y-4">
          <p className="rounded-lg bg-paper px-3 py-2 text-sm">Punto de venta: <strong>{pointName}</strong></p>
          <Field label="Descripción"><Input required minLength={2} maxLength={191} autoFocus value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Guardando...' : 'Guardar'}</Button></div>
        </form>
      </Modal>
    </section>
  );
}
