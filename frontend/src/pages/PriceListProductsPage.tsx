import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Layers3, Pencil, Percent, Plus, Search } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { pointsOfSaleApi, priceListApi, suppliersApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { PriceListProduct } from '../types';
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Toggle, useToast } from '../ui/components';
import { downloadBlob } from '../utils/download';
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

function PercentagePricesAdjuster({
  primaryPrice,
  secondaryPrice,
  onApply,
}: {
  primaryPrice: string;
  secondaryPrice: string;
  onApply: (prices: { primaryPrice: string; secondaryPrice: string }) => void;
}) {
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [target, setTarget] = useState<'BOTH' | 'PRIMARY' | 'SECONDARY'>('BOTH');
  const [percentage, setPercentage] = useState('');
  const [roundToNextThousand, setRoundToNextThousand] = useState(false);
  const percentageValue = percentage === '' ? null : Number(percentage);
  const validPercentage = percentageValue !== null
    && Number.isFinite(percentageValue)
    && Number.isInteger(percentageValue)
    && percentageValue > 0
    && (direction === 'INCREASE' || percentageValue <= 100);
  const appliesToPrimary = target === 'BOTH' || target === 'PRIMARY';
  const appliesToSecondary = target === 'BOTH' || target === 'SECONDARY';
  const calculateFuturePrice = (price: string, applies: boolean) => {
    if (!applies) return null;
    const basePrice = price === '' ? null : Number(price);
    if (basePrice === null || !Number.isFinite(basePrice) || !validPercentage) return null;
    const calculated = Math.max(0, Math.round(basePrice * (direction === 'INCREASE' ? 1 + percentageValue! / 100 : 1 - percentageValue! / 100) * 100) / 100);
    return roundToNextThousand ? Math.ceil(calculated / 1000) * 1000 : calculated;
  };
  const futurePrimaryPrice = calculateFuturePrice(primaryPrice, appliesToPrimary);
  const futureSecondaryPrice = calculateFuturePrice(secondaryPrice, appliesToSecondary);
  const hasFuturePrice = futurePrimaryPrice !== null || futureSecondaryPrice !== null;
  const targetLabel = target === 'BOTH' ? 'ambos precios' : target === 'PRIMARY' ? 'precio principal' : 'precio secundario';

  return (
    <div className="rounded-lg bg-paper p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mute">Ajuste por porcentaje</p>
      <div className="grid gap-2 sm:grid-cols-[1.3fr_1fr_110px]">
        <Select value={target} onChange={(event) => setTarget(event.target.value as 'BOTH' | 'PRIMARY' | 'SECONDARY')} aria-label="Precio a ajustar">
          <option value="BOTH">Ambos precios</option>
          <option value="PRIMARY">Solo principal</option>
          <option value="SECONDARY">Solo secundario</option>
        </Select>
        <Select value={direction} onChange={(event) => setDirection(event.target.value as 'INCREASE' | 'DECREASE')} aria-label="Tipo de ajuste">
          <option value="INCREASE">Subir</option>
          <option value="DECREASE">Disminuir</option>
        </Select>
        <div className="relative">
          <Input
            type="number"
            min="1"
            max={direction === 'DECREASE' ? '100' : '1000'}
            step="1"
            value={percentage}
            onChange={(event) => /^\d*$/.test(event.target.value) && setPercentage(event.target.value)}
            placeholder="0"
            aria-label="Porcentaje"
            className="pr-7"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-mute">%</span>
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <Button
          variant="secondary"
          className={roundToNextThousand ? 'border-brand bg-brand-soft text-brand' : ''}
          onClick={() => setRoundToNextThousand((current) => !current)}
        >
          {roundToNextThousand ? 'Quitar redondeo' : 'Redondear al siguiente mil'}
        </Button>
      </div>
      <div className="mt-3 grid gap-2 rounded-lg bg-surface px-3 py-2 sm:grid-cols-2">
        <div><p className="text-[10px] font-bold uppercase tracking-wide text-mute">Futuro principal</p><p className="font-extrabold text-brand">{!appliesToPrimary ? 'Sin cambios' : futurePrimaryPrice === null ? 'Sin cálculo' : money(futurePrimaryPrice)}</p></div>
        <div><p className="text-[10px] font-bold uppercase tracking-wide text-mute">Futuro secundario</p><p className="font-extrabold text-brand">{!appliesToSecondary ? 'Sin cambios' : futureSecondaryPrice === null ? 'Sin cálculo' : money(futureSecondaryPrice)}</p></div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-mute">El porcentaje entero se aplicará al {targetLabel}.</p>
        <Button
          variant="secondary"
          className="shrink-0 px-3"
          disabled={!hasFuturePrice}
          onClick={() => onApply({
            primaryPrice: futurePrimaryPrice === null ? primaryPrice : String(futurePrimaryPrice),
            secondaryPrice: futureSecondaryPrice === null ? secondaryPrice : String(futureSecondaryPrice),
          })}
        >
          Aplicar cálculo
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-mute">Los valores se confirman definitivamente al guardar el producto.</p>
    </div>
  );
}

type PriceAdjustmentTarget = 'BOTH' | 'PRIMARY' | 'SECONDARY';
type PriceAdjustmentDirection = 'INCREASE' | 'DECREASE';
type BulkPriceUpdate = { productId: string; primaryPrice?: number | null; secondaryPrice?: number | null };

function adjustedPrice(
  currentPrice: number | null | undefined,
  applies: boolean,
  percentage: number,
  direction: PriceAdjustmentDirection,
  roundToThousand: boolean,
) {
  if (currentPrice == null || !applies) return currentPrice ?? null;
  const factor = direction === 'INCREASE' ? 1 + percentage / 100 : 1 - percentage / 100;
  const calculated = Math.max(0, Math.round(currentPrice * factor * 100) / 100);
  return roundToThousand ? Math.ceil(calculated / 1000) * 1000 : calculated;
}

function BulkPriceAdjustmentModal({
  products,
  categories,
  suppliers,
  pointOfSaleName,
  loading,
  saving,
  error,
  onClose,
  onSave,
}: {
  products: PriceListProduct[];
  categories: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  pointOfSaleName: string;
  loading: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (updates: BulkPriceUpdate[]) => void;
}) {
  const [filterSearch, setFilterSearch] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<PriceAdjustmentTarget>('BOTH');
  const [direction, setDirection] = useState<PriceAdjustmentDirection>('INCREASE');
  const [percentage, setPercentage] = useState('');
  const [globalRounding, setGlobalRounding] = useState(false);
  const [roundingOverrides, setRoundingOverrides] = useState<Record<string, boolean>>({});

  const normalizedSearch = filterSearch.trim().toLocaleLowerCase('es-CO');
  const filteredProducts = useMemo(() => products.filter((product) => {
    if (filterCategoryId && product.categoryId !== filterCategoryId) return false;
    if (filterSupplierId && product.supplierId !== filterSupplierId) return false;
    if (!normalizedSearch) return true;
    return [product.reference, product.measure, product.presentation, product.supplier.name, product.category.name]
      .some((value) => value?.toLocaleLowerCase('es-CO').includes(normalizedSearch));
  }), [products, filterCategoryId, filterSupplierId, normalizedSearch]);
  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.has(product.id)),
    [products, selectedIds],
  );
  const percentageValue = percentage === '' ? 0 : Number(percentage);
  const validPercentage = Number.isInteger(percentageValue)
    && percentageValue > 0
    && (direction === 'INCREASE' || percentageValue <= 100);
  const appliesToPrimary = target === 'BOTH' || target === 'PRIMARY';
  const appliesToSecondary = target === 'BOTH' || target === 'SECONDARY';
  const allFilteredSelected = filteredProducts.length > 0
    && filteredProducts.every((product) => selectedIds.has(product.id));
  const allPointSelected = products.length > 0 && selectedIds.size === products.length;
  const isRounded = (productId: string) => roundingOverrides[productId] ?? globalRounding;
  const preview = selectedProducts.map((product) => ({
    product,
    futurePrimaryPrice: validPercentage
      ? adjustedPrice(product.primaryPrice, appliesToPrimary, percentageValue, direction, isRounded(product.id))
      : product.primaryPrice ?? null,
    futureSecondaryPrice: validPercentage
      ? adjustedPrice(product.secondaryPrice, appliesToSecondary, percentageValue, direction, isRounded(product.id))
      : product.secondaryPrice ?? null,
  }));
  const updates: BulkPriceUpdate[] = validPercentage ? preview.flatMap(({ product, futurePrimaryPrice, futureSecondaryPrice }) => {
    const update: BulkPriceUpdate = { productId: product.id };
    if (appliesToPrimary && product.primaryPrice != null) update.primaryPrice = futurePrimaryPrice;
    if (appliesToSecondary && product.secondaryPrice != null) update.secondaryPrice = futureSecondaryPrice;
    return update.primaryPrice === undefined && update.secondaryPrice === undefined ? [] : [update];
  }) : [];

  const toggleProduct = (productId: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    return next;
  });
  const toggleFiltered = () => setSelectedIds((current) => {
    const next = new Set(current);
    filteredProducts.forEach((product) => {
      if (allFilteredSelected) next.delete(product.id);
      else next.add(product.id);
    });
    return next;
  });
  const toggleAllPoint = () => {
    setSelectedIds(allPointSelected ? new Set() : new Set(products.map((product) => product.id)));
  };
  const toggleProductRounding = (productId: string) => {
    setRoundingOverrides((current) => ({ ...current, [productId]: !isRounded(productId) }));
  };
  const toggleGlobalRounding = () => {
    setGlobalRounding((current) => !current);
    setRoundingOverrides({});
  };

  return (
    <Modal open onClose={onClose} title="Ajuste masivo de precios" size="large">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-dark">
          <span>Punto de venta: <strong>{pointOfSaleName}</strong></span>
          <span><strong>{selectedIds.size}</strong> de {products.length} productos seleccionados</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Buscar producto"><Input value={filterSearch} onChange={(event) => setFilterSearch(event.target.value)} placeholder="Referencia, medida o proveedor" /></Field>
          <Field label="Categoría"><Select value={filterCategoryId} onChange={(event) => setFilterCategoryId(event.target.value)}><option value="">Todas</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field>
          <Field label="Proveedor"><Select value={filterSupplierId} onChange={(event) => setFilterSupplierId(event.target.value)}><option value="">Todos</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</Select></Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={toggleFiltered} disabled={!filteredProducts.length}>{allFilteredSelected ? 'Quitar productos filtrados' : `Seleccionar filtrados (${filteredProducts.length})`}</Button>
          <Button variant={allPointSelected ? 'primary' : 'secondary'} onClick={toggleAllPoint} disabled={!products.length}>{allPointSelected ? 'Quitar todo el punto de venta' : `Todo el punto de venta (${products.length})`}</Button>
          <Button variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size}>Limpiar selección</Button>
        </div>

        {loading ? <Spinner /> : <div className="max-h-56 overflow-auto rounded-lg border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 bg-paper text-left text-[10px] uppercase text-mute"><tr><th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Seleccionar productos filtrados" checked={allFilteredSelected} onChange={toggleFiltered} /></th><th className="px-3 py-2">Referencia</th><th className="px-3 py-2">Categoría</th><th className="px-3 py-2">Proveedor</th><th className="px-3 py-2 text-right">Principal</th><th className="px-3 py-2 text-right">Secundario</th></tr></thead>
            <tbody className="divide-y divide-line">{filteredProducts.map((product) => <tr key={product.id} className={selectedIds.has(product.id) ? 'bg-brand-soft/40' : ''}><td className="px-3 py-2"><input type="checkbox" aria-label={`Seleccionar ${product.reference}`} checked={selectedIds.has(product.id)} onChange={() => toggleProduct(product.id)} /></td><td className="px-3 py-2 font-semibold">{product.reference}</td><td className="px-3 py-2">{product.category.name}</td><td className="px-3 py-2">{product.supplier.name}</td><td className="px-3 py-2 text-right">{product.primaryPrice == null ? '—' : money(product.primaryPrice)}</td><td className="px-3 py-2 text-right">{product.secondaryPrice == null ? '—' : money(product.secondaryPrice)}</td></tr>)}</tbody>
          </table>
          {!filteredProducts.length && <p className="p-5 text-center text-sm text-mute">No hay productos para estos filtros.</p>}
        </div>}

        <div className="rounded-lg bg-paper p-3">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-mute">Cálculo del ajuste</p>
          <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_110px_auto] sm:items-end">
            <Field label="Precios"><Select value={target} onChange={(event) => setTarget(event.target.value as PriceAdjustmentTarget)}><option value="BOTH">Ambos precios</option><option value="PRIMARY">Solo principal</option><option value="SECONDARY">Solo secundario</option></Select></Field>
            <Field label="Operación"><Select value={direction} onChange={(event) => setDirection(event.target.value as PriceAdjustmentDirection)}><option value="INCREASE">Subir</option><option value="DECREASE">Disminuir</option></Select></Field>
            <Field label="Porcentaje"><div className="relative"><Input type="number" min="1" max={direction === 'DECREASE' ? '100' : '1000'} step="1" value={percentage} onChange={(event) => /^\d*$/.test(event.target.value) && setPercentage(event.target.value)} placeholder="0" className="pr-7" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-mute">%</span></div></Field>
            <Button variant={globalRounding ? 'primary' : 'secondary'} onClick={toggleGlobalRounding}>{globalRounding ? 'Redondeo general activo' : 'Ajustar todos a $1.000'}</Button>
          </div>
          <p className="mt-2 text-[11px] text-mute">El porcentaje solo acepta enteros. El redondeo lleva el resultado al siguiente múltiplo de $1.000.</p>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-mute">Comparativo antes de guardar</p><span className="text-xs text-mute">{updates.length} productos con precio aplicable</span></div>
          <div className="max-h-72 overflow-auto rounded-lg border border-line">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="sticky top-0 bg-paper text-left text-[10px] uppercase text-mute"><tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2 text-right">Principal anterior</th><th className="px-3 py-2 text-right">Principal futuro</th><th className="px-3 py-2 text-right">Secundario anterior</th><th className="px-3 py-2 text-right">Secundario futuro</th><th className="px-3 py-2 text-center">Ajustar a $1.000</th></tr></thead>
              <tbody className="divide-y divide-line">{preview.map(({ product, futurePrimaryPrice, futureSecondaryPrice }) => <tr key={product.id}><td className="px-3 py-2"><p className="font-semibold">{product.reference}</p><p className="text-[10px] text-mute">{product.category.name} · {product.supplier.name}</p></td><td className="px-3 py-2 text-right">{product.primaryPrice == null ? '—' : money(product.primaryPrice)}</td><td className={`px-3 py-2 text-right font-bold ${appliesToPrimary ? 'text-brand' : 'text-mute'}`}>{futurePrimaryPrice == null ? '—' : money(futurePrimaryPrice)}</td><td className="px-3 py-2 text-right">{product.secondaryPrice == null ? '—' : money(product.secondaryPrice)}</td><td className={`px-3 py-2 text-right font-bold ${appliesToSecondary ? 'text-brand' : 'text-mute'}`}>{futureSecondaryPrice == null ? '—' : money(futureSecondaryPrice)}</td><td className="px-3 py-2 text-center"><input type="checkbox" aria-label={`Ajustar ${product.reference} al siguiente millar`} checked={isRounded(product.id)} onChange={() => toggleProductRounding(product.id)} /></td></tr>)}</tbody>
            </table>
            {!selectedProducts.length && <p className="p-6 text-center text-sm text-mute">Selecciona uno o varios productos para ver la comparación.</p>}
          </div>
        </div>

        {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-mute">Los cambios se guardarán únicamente en <strong>{pointOfSaleName}</strong>.</p>
          <div className="flex gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!updates.length || saving} onClick={() => onSave(updates)}>{saving ? 'Guardando...' : `Guardar ${updates.length} ajustes`}</Button></div>
        </div>
      </div>
    </Modal>
  );
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
  const [adjusting, setAdjusting] = useState<PriceListProduct | null>(null);
  const [bulkAdjustmentOpen, setBulkAdjustmentOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [adjustedPrices, setAdjustedPrices] = useState({ primaryPrice: '', secondaryPrice: '' });
  const [adjustmentApplied, setAdjustmentApplied] = useState(false);
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
  const { data: bulkProducts = [], isLoading: bulkProductsLoading } = useQuery({
    queryKey: ['price-list-products', 'bulk-adjustment', pointOfSaleId],
    queryFn: () => priceListApi.products({ pointOfSaleId, isActive: true }),
    enabled: bulkAdjustmentOpen && Boolean(pointOfSaleId),
  });

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
      setAdjusting(null);
    },
    onError: (err) => setError(apiError(err, 'No se pudo actualizar el producto')),
  });
  const bulkUpdate = useMutation({
    mutationFn: (updates: BulkPriceUpdate[]) => priceListApi.bulkUpdatePrices({ pointOfSaleId, updates }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['price-list-products'] });
      toast(`${result.updated} productos actualizados`);
      setBulkAdjustmentOpen(false);
    },
    onError: (err) => setError(apiError(err, 'No se pudieron actualizar los precios')),
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
  const openPercentageAdjustment = (product: PriceListProduct) => {
    setAdjusting(product);
    setAdjustedPrices({
      primaryPrice: product.primaryPrice == null ? '' : String(product.primaryPrice),
      secondaryPrice: product.secondaryPrice == null ? '' : String(product.secondaryPrice),
    });
    setAdjustmentApplied(false);
    setError('');
  };
  const openBulkAdjustment = () => {
    setError('');
    setBulkAdjustmentOpen(true);
  };
  const exportExcel = async () => {
    const exportPointOfSaleId = isAdmin ? pointOfSaleId : undefined;
    const pointOfSaleName = isAdmin
      ? points.find((point) => point.id === pointOfSaleId)?.name
      : user?.pointOfSale?.name;
    if (!pointOfSaleName || (isAdmin && !pointOfSaleId)) {
      toast('Selecciona un punto de venta para exportar', 'error');
      return;
    }
    setExporting(true);
    try {
      const blob = await priceListApi.exportExcel(exportPointOfSaleId);
      const dateParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(new Date());
      const dateValues = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
      const date = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
      const safePointName = pointOfSaleName.replace(/[\\/:*?"<>|]/g, '-');
      downloadBlob(blob, `Listado de precios - ${safePointName} - ${date}.xlsx`);
      toast('Listado de precios generado');
    } catch (err) {
      toast(apiError(err, 'No se pudo generar el Excel'), 'error');
    } finally {
      setExporting(false);
    }
  };
  const savePercentageAdjustment = async () => {
    if (!adjusting || !adjustmentApplied) return;
    await update.mutateAsync({
      id: adjusting.id,
      payload: {
        pointOfSaleId,
        primaryPrice: adjustedPrices.primaryPrice === '' ? null : Number(adjustedPrices.primaryPrice),
        secondaryPrice: adjustedPrices.secondaryPrice === '' ? null : Number(adjustedPrices.secondaryPrice),
      },
    });
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
        <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={exporting || (isAdmin && !pointOfSaleId)} title={isAdmin && !pointOfSaleId ? 'Selecciona un punto de venta' : 'Generar Excel por categorías'} onClick={exportExcel}><Download className="h-4 w-4" /> {exporting ? 'Generando...' : 'Excel'}</Button>{canEdit && <><Button variant="secondary" disabled={!pointOfSaleId} title={pointOfSaleId ? 'Ajustar varios productos' : 'Selecciona un punto de venta'} onClick={openBulkAdjustment}><Percent className="h-4 w-4" /> Ajuste masivo</Button><Button variant="secondary" onClick={() => setCategoryModalOpen(true)}><Layers3 className="h-4 w-4" /> Categoría</Button><Button onClick={openCreate}><Plus className="h-4 w-4" /> Producto</Button></>}</div>
      </div>

      <Card className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Buscar"><div className="relative"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Referencia, medida o presentación" className="pl-9" /><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" /></div></Field>
        <Field label="Categoría"><Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Todas</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="Proveedor"><Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Todos</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        {isAdmin ? <Field label="Punto de venta"><Select value={pointOfSaleId} onChange={(event) => setPointOfSaleId(event.target.value)}><option value="">Precio general</option>{points.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field> : <Field label="Punto de venta"><Input disabled value={user?.pointOfSale?.name || 'Sin asignar'} /></Field>}
      </Card>

      {isLoading ? <Spinner /> : data.length ? <Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full min-w-[900px] table-fixed text-sm">
        <thead className="bg-paper text-left text-[10px] uppercase text-mute"><tr><th className="w-[9%] px-3 py-3">Categoría</th><th className="w-[10%] px-3 py-3">Proveedor</th><th className="w-[20%] px-3 py-3">Referencia</th><th className="w-[8%] px-3 py-3">Medida</th><th className="w-[12%] px-3 py-3">Presentación</th><th className="w-[14%] px-3 py-3">Precio principal</th><th className="w-[14%] px-3 py-3">Precio secundario</th>{canEdit && <th className="w-[13%] px-3 py-3 text-right">Acciones</th>}</tr></thead>
        <tbody className="divide-y divide-line">{data.map((product) => <tr key={product.id} className={!product.isActive ? 'opacity-50' : ''}>
          <td className="break-words px-3 py-3 font-semibold text-brand">{product.category.name}</td><td className="break-words px-3 py-3">{product.supplier.name}</td><td className="break-words px-3 py-3 font-semibold">{product.reference}</td><td className="break-words px-3 py-3">{product.measure || '—'}</td><td className="break-words px-3 py-3">{product.presentation || '—'}</td>
          <td className="break-words px-3 py-3"><p className="mb-1 text-[9px] uppercase text-mute">{product.primaryPriceLabel}</p><PriceCell value={product.primaryPrice} note={product.primaryPriceNote} /></td>
          <td className="break-words px-3 py-3"><p className="mb-1 text-[9px] uppercase text-mute">{product.secondaryPriceLabel}</p><PriceCell value={product.secondaryPrice} note={product.secondaryPriceNote} /></td>
          {canEdit && <td className="px-3 py-3"><div className="flex items-center justify-end gap-1"><Toggle checked={product.isActive} onChange={(isActive) => update.mutate({ id: product.id, payload: { isActive } })} label="Cambiar estado" /><Button variant="ghost" className="px-2" aria-label={`Ajustar porcentaje ${product.reference}`} disabled={!pointOfSaleId} title={pointOfSaleId ? 'Subir o disminuir por porcentaje' : 'Selecciona un punto de venta'} onClick={() => openPercentageAdjustment(product)}><Percent className="h-4 w-4" /></Button><Button variant="ghost" className="px-2" aria-label={`Editar ${product.reference}`} disabled={!pointOfSaleId} title={pointOfSaleId ? 'Editar producto y precio' : 'Selecciona un punto de venta'} onClick={() => openEdit(product)}><Pencil className="h-4 w-4" /></Button></div></td>}
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
          <Field label="Precio principal"><Input type="number" min="0" step="0.01" value={form.primaryPrice} onChange={(event) => setForm({ ...form, primaryPrice: event.target.value })} /></Field>
          <Field label="Precio secundario"><Input type="number" min="0" step="0.01" value={form.secondaryPrice} onChange={(event) => setForm({ ...form, secondaryPrice: event.target.value })} /></Field>
          <Field label="Anotación precio principal"><Input maxLength={300} placeholder="Ej. PRECIO POR KILO" value={form.primaryPriceNote} onChange={(event) => setForm({ ...form, primaryPriceNote: event.target.value })} /></Field>
          <Field label="Anotación precio secundario"><Input maxLength={300} placeholder="Ej. SOLO ROLLO" value={form.secondaryPriceNote} onChange={(event) => setForm({ ...form, secondaryPriceNote: event.target.value })} /></Field>
          {error && <p className="md:col-span-2 rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <div className="flex justify-end gap-2 md:col-span-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={create.isPending || update.isPending}>Guardar</Button></div>
        </form>
      </Modal>

      <Modal open={adjusting !== null} onClose={() => setAdjusting(null)} title="Ajustar precios por porcentaje" size="large">
        {adjusting && <div className="space-y-4">
          <div className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-dark">
            <strong>{adjusting.reference}</strong> · {points.find((point) => point.id === pointOfSaleId)?.name || 'Punto de venta seleccionado'}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line p-3"><p className="text-[10px] font-bold uppercase text-mute">Precio principal actual</p><p className="mt-1 text-lg font-extrabold">{adjusting.primaryPrice == null ? 'Sin precio' : money(adjusting.primaryPrice)}</p></div>
            <div className="rounded-lg border border-line p-3"><p className="text-[10px] font-bold uppercase text-mute">Precio secundario actual</p><p className="mt-1 text-lg font-extrabold">{adjusting.secondaryPrice == null ? 'Sin precio' : money(adjusting.secondaryPrice)}</p></div>
          </div>
          <PercentagePricesAdjuster
            primaryPrice={adjusting.primaryPrice == null ? '' : String(adjusting.primaryPrice)}
            secondaryPrice={adjusting.secondaryPrice == null ? '' : String(adjusting.secondaryPrice)}
            onApply={(prices) => { setAdjustedPrices(prices); setAdjustmentApplied(true); }}
          />
          {adjustmentApplied && <div className="grid gap-3 rounded-lg border border-brand/25 bg-brand-soft p-3 sm:grid-cols-2">
            <div><p className="text-[10px] font-bold uppercase text-mute">Principal a guardar</p><p className="font-extrabold text-brand">{adjustedPrices.primaryPrice === '' ? 'Sin precio' : money(Number(adjustedPrices.primaryPrice))}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-mute">Secundario a guardar</p><p className="font-extrabold text-brand">{adjustedPrices.secondaryPrice === '' ? 'Sin precio' : money(Number(adjustedPrices.secondaryPrice))}</p></div>
          </div>}
          {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setAdjusting(null)}>Cancelar</Button><Button disabled={!adjustmentApplied || update.isPending} onClick={savePercentageAdjustment}>{update.isPending ? 'Guardando...' : 'Guardar ajuste'}</Button></div>
        </div>}
      </Modal>

      {bulkAdjustmentOpen && <BulkPriceAdjustmentModal
        products={bulkProducts}
        categories={categories.filter((category) => category.isActive)}
        suppliers={suppliers.filter((supplier) => supplier.isActive)}
        pointOfSaleName={points.find((point) => point.id === pointOfSaleId)?.name || 'Punto de venta seleccionado'}
        loading={bulkProductsLoading}
        saving={bulkUpdate.isPending}
        error={error}
        onClose={() => setBulkAdjustmentOpen(false)}
        onSave={(updates) => bulkUpdate.mutate(updates)}
      />}

      <Modal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title="Nueva categoría">
        <form onSubmit={(event) => { event.preventDefault(); createCategory.mutate({ name: categoryName }); }} className="space-y-4"><Field label="Nombre"><Input required minLength={2} maxLength={191} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></Field><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCategoryModalOpen(false)}>Cancelar</Button><Button type="submit">Crear</Button></div></form>
      </Modal>
    </section>
  );
}
