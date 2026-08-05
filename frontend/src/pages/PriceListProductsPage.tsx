import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers3, Pencil, Plus, Search } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { pointsOfSaleApi, priceListApi, suppliersApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { PriceListProduct } from '../types';
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Toggle, useToast } from '../ui/components';
import { money } from '../utils/format';
import { isAdminRole, isSuperAdminRole } from '../utils/roles';

const emptyForm = {
  categoryId: '', supplierId: '', reference: '', measure: '', presentation: '',
  primaryPriceLabel: 'VALOR POR PACA', secondaryPriceLabel: 'VALOR UNITARIO',
  primaryPrice: '', secondaryPrice: '', primaryPriceNote: '', secondaryPriceNote: '',
};

function apiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  return (Array.isArray(message) ? message[0] : message) || fallback;
}

function PriceCell({ value, note }: { value?: number | null; note?: string | null }) {
  if (value == null && !note) return <span className="text-mute">—</span>;
  return <div><p className="font-semibold">{value == null ? '—' : money(value)}</p>{note && <p className="mt-0.5 max-w-48 text-xs text-mute">{note}</p>}</div>;
}

export function PriceListProductsPage() {
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const canEdit = isSuperAdminRole(user?.role);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [pointOfSaleId, setPointOfSaleId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editing, setEditing] = useState<PriceListProduct | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const { data: categories = [] } = useQuery({ queryKey: ['price-list-categories'], queryFn: priceListApi.categories });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });
  const { data: points = [] } = useQuery({ queryKey: ['points-of-sale'], queryFn: pointsOfSaleApi.list, enabled: isAdmin });
  useEffect(() => {
    if (isAdmin && !pointOfSaleId && points.length) setPointOfSaleId(points[0].id);
  }, [isAdmin, pointOfSaleId, points]);

  const params = useMemo(() => Object.fromEntries(Object.entries({
    search: search || undefined,
    categoryId: categoryId || undefined,
    supplierId: supplierId || undefined,
    pointOfSaleId: isAdmin ? pointOfSaleId || undefined : undefined,
    isActive: canEdit ? undefined : true,
  }).filter(([, value]) => value !== undefined)), [search, categoryId, supplierId, pointOfSaleId, isAdmin, canEdit]);
  const { data = [], isLoading } = useQuery({ queryKey: ['price-list-products', params], queryFn: () => priceListApi.products(params) });

  const create = useMutation({
    mutationFn: priceListApi.createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-list-products'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast('Producto agregado a la lista');
      setModalOpen(false);
    },
    onError: (err) => setError(apiError(err, 'No se pudo crear el producto')),
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof priceListApi.updateProduct>[1] }) => priceListApi.updateProduct(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-list-products'] });
      toast('Producto actualizado');
      setModalOpen(false);
    },
    onError: (err) => setError(apiError(err, 'No se pudo actualizar el producto')),
  });
  const createCategory = useMutation({
    mutationFn: priceListApi.createCategory,
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ['price-list-categories'] });
      setForm((current) => ({ ...current, categoryId: category.id }));
      setCategoryModalOpen(false);
      setCategoryName('');
      toast('Categoría creada');
    },
    onError: (err) => toast(apiError(err, 'No se pudo crear la categoría'), 'error'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id || '', supplierId: suppliers.find((item) => item.isActive)?.id || '' });
    setError('');
    setModalOpen(true);
  };
  const openEdit = (product: PriceListProduct) => {
    setEditing(product);
    setForm({
      categoryId: product.categoryId, supplierId: product.supplierId, reference: product.reference,
      measure: product.measure || '', presentation: product.presentation || '', primaryPriceLabel: product.primaryPriceLabel,
      secondaryPriceLabel: product.secondaryPriceLabel,
      primaryPrice: product.primaryPrice == null ? '' : String(product.primaryPrice),
      secondaryPrice: product.secondaryPrice == null ? '' : String(product.secondaryPrice),
      primaryPriceNote: product.primaryPriceNote || '',
      secondaryPriceNote: product.secondaryPriceNote || '',
    });
    setError('');
    setModalOpen(true);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (editing) {
      await update.mutateAsync({ id: editing.id, payload: {
        categoryId: form.categoryId, supplierId: form.supplierId, reference: form.reference,
        measure: form.measure, presentation: form.presentation, primaryPriceLabel: form.primaryPriceLabel,
        secondaryPriceLabel: form.secondaryPriceLabel,
        pointOfSaleId,
        primaryPrice: form.primaryPrice === '' ? null : Number(form.primaryPrice),
        secondaryPrice: form.secondaryPrice === '' ? null : Number(form.secondaryPrice),
        primaryPriceNote: form.primaryPriceNote,
        secondaryPriceNote: form.secondaryPriceNote,
      } });
    } else {
      await create.mutateAsync({
        ...form,
        primaryPrice: form.primaryPrice === '' ? undefined : Number(form.primaryPrice),
        secondaryPrice: form.secondaryPrice === '' ? undefined : Number(form.secondaryPrice),
      });
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Lista de precios</h1><p className="text-sm text-mute">Catálogo independiente de los productos usados en pedidos.</p></div>
        {canEdit && <div className="flex gap-2"><Button variant="secondary" onClick={() => setCategoryModalOpen(true)}><Layers3 className="h-4 w-4" /> Categoría</Button><Button onClick={openCreate}><Plus className="h-4 w-4" /> Producto</Button></div>}
      </div>

      <Card className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Buscar"><div className="relative"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Referencia, medida o presentación" className="pl-9" /><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" /></div></Field>
        <Field label="Categoría"><Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Todas</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="Proveedor"><Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Todos</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        {isAdmin ? <Field label="Punto de venta"><Select value={pointOfSaleId} onChange={(event) => setPointOfSaleId(event.target.value)}><option value="">Precio general</option>{points.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field> : <Field label="Punto de venta"><Input disabled value={user?.pointOfSale?.name || 'Sin asignar'} /></Field>}
      </Card>

      {isLoading ? <Spinner /> : data.length ? <Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full min-w-[900px] table-fixed text-sm">
        <thead className="bg-paper text-left text-[10px] uppercase text-mute"><tr><th className="w-[9%] px-3 py-3">Categoría</th><th className="w-[10%] px-3 py-3">Proveedor</th><th className="w-[22%] px-3 py-3">Referencia</th><th className="w-[8%] px-3 py-3">Medida</th><th className="w-[13%] px-3 py-3">Presentación</th><th className="w-[14%] px-3 py-3">Precio principal</th><th className="w-[14%] px-3 py-3">Precio secundario</th>{canEdit && <th className="w-[10%] px-3 py-3 text-right">Acciones</th>}</tr></thead>
        <tbody className="divide-y divide-line">{data.map((product) => <tr key={product.id} className={!product.isActive ? 'opacity-50' : ''}>
          <td className="break-words px-3 py-3 font-semibold text-brand">{product.category.name}</td><td className="break-words px-3 py-3">{product.supplier.name}</td><td className="break-words px-3 py-3 font-semibold">{product.reference}</td><td className="break-words px-3 py-3">{product.measure || '—'}</td><td className="break-words px-3 py-3">{product.presentation || '—'}</td>
          <td className="break-words px-3 py-3"><p className="mb-1 text-[9px] uppercase text-mute">{product.primaryPriceLabel}</p><PriceCell value={product.primaryPrice} note={product.primaryPriceNote} /></td>
          <td className="break-words px-3 py-3"><p className="mb-1 text-[9px] uppercase text-mute">{product.secondaryPriceLabel}</p><PriceCell value={product.secondaryPrice} note={product.secondaryPriceNote} /></td>
          {canEdit && <td className="px-3 py-3"><div className="flex items-center justify-end gap-1"><Toggle checked={product.isActive} onChange={(isActive) => update.mutate({ id: product.id, payload: { isActive } })} label="Cambiar estado" /><Button variant="ghost" className="px-2" aria-label={`Editar ${product.reference}`} disabled={!pointOfSaleId} title={pointOfSaleId ? 'Editar producto y precio' : 'Selecciona un punto de venta'} onClick={() => openEdit(product)}><Pencil className="h-4 w-4" /></Button></div></td>}
        </tr>)}</tbody>
      </table></div></Card> : <EmptyState title="No hay productos para estos filtros" />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar producto de lista' : 'Nuevo producto de lista'} size="large">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          {editing && <div className="md:col-span-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-dark">Editando precios y anotaciones para <strong>{points.find((point) => point.id === pointOfSaleId)?.name || 'el punto de venta seleccionado'}</strong>.</div>}
          <Field label="Categoría"><Select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Selecciona</option>{categories.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Proveedor"><Select required value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}><option value="">Selecciona</option>{suppliers.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <div className="md:col-span-2"><Field label="Referencia"><Input required maxLength={500} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></Field></div>
          <Field label="Medida (opcional)"><Input maxLength={300} value={form.measure} onChange={(event) => setForm({ ...form, measure: event.target.value })} /></Field>
          <Field label="Presentación (opcional)"><Input maxLength={300} value={form.presentation} onChange={(event) => setForm({ ...form, presentation: event.target.value })} /></Field>
          <Field label="Nombre precio principal"><Input required value={form.primaryPriceLabel} onChange={(event) => setForm({ ...form, primaryPriceLabel: event.target.value })} /></Field>
          <Field label="Nombre precio secundario"><Input required value={form.secondaryPriceLabel} onChange={(event) => setForm({ ...form, secondaryPriceLabel: event.target.value })} /></Field>
          <Field label="Precio principal"><Input type="number" min="0" step="0.01" value={form.primaryPrice} onChange={(event) => setForm({ ...form, primaryPrice: event.target.value })} /></Field><Field label="Precio secundario"><Input type="number" min="0" step="0.01" value={form.secondaryPrice} onChange={(event) => setForm({ ...form, secondaryPrice: event.target.value })} /></Field><Field label="Anotación precio principal"><Input maxLength={300} placeholder="Ej. PRECIO POR KILO" value={form.primaryPriceNote} onChange={(event) => setForm({ ...form, primaryPriceNote: event.target.value })} /></Field><Field label="Anotación precio secundario"><Input maxLength={300} placeholder="Ej. SOLO ROLLO" value={form.secondaryPriceNote} onChange={(event) => setForm({ ...form, secondaryPriceNote: event.target.value })} /></Field>
          {error && <p className="md:col-span-2 rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <div className="flex justify-end gap-2 md:col-span-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={create.isPending || update.isPending}>Guardar</Button></div>
        </form>
      </Modal>

      <Modal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title="Nueva categoría">
        <form onSubmit={(event) => { event.preventDefault(); createCategory.mutate({ name: categoryName }); }} className="space-y-4"><Field label="Nombre"><Input required minLength={2} maxLength={191} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></Field><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCategoryModalOpen(false)}>Cancelar</Button><Button type="submit">Crear</Button></div></form>
      </Modal>
    </section>
  );
}
