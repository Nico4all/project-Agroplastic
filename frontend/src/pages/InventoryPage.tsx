import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Boxes, Download, FileText, PackagePlus, Search, Trash2, TriangleAlert } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { inventoryApi, pointsOfSaleApi, productsApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { Button, Card, EmptyState, Field, Input, Modal, Pagination, SearchableSelect, Select, Spinner, useToast } from '../ui/components';
import { dateInput } from '../utils/format';
import { downloadBlob } from '../utils/download';
import { isAdminRole } from '../utils/roles';

type EntryLine = { productId: string; quantity: string };
const emptyLine = (): EntryLine => ({ productId: '', quantity: '1' });
const today = () => new Date().toLocaleDateString('en-CA');

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

export function InventoryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = isAdminRole(user?.role);
  const [pointOfSaleId, setPointOfSaleId] = useState(user?.pointOfSaleId || '');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', search: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [remittanceNumber, setRemittanceNumber] = useState('');
  const [entryDate, setEntryDate] = useState(today());
  const [observations, setObservations] = useState('');
  const [lines, setLines] = useState<EntryLine[]>([emptyLine()]);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentPointOfSaleId, setAdjustmentPointOfSaleId] = useState('');
  const [adjustmentProductId, setAdjustmentProductId] = useState('');
  const [adjustmentOperation, setAdjustmentOperation] = useState<'ADD' | 'SUBTRACT'>('ADD');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('1');
  const [adjustmentError, setAdjustmentError] = useState('');
  const { data: points = [] } = useQuery({ queryKey: ['points-of-sale'], queryFn: pointsOfSaleApi.list, enabled: isAdmin });

  useEffect(() => {
    if (isAdmin && !pointOfSaleId && points.length) setPointOfSaleId(points[0].id);
  }, [isAdmin, pointOfSaleId, points]);

  const baseParams = useMemo(() => ({ ...(pointOfSaleId ? { pointOfSaleId } : {}) }), [pointOfSaleId]);
  const entryParams = useMemo(() => Object.fromEntries(Object.entries({ page, pageSize: 10, ...baseParams, ...filters }).filter(([, value]) => value !== '')), [page, baseParams, filters]);
  const { data: stocks = [], isLoading: stocksLoading } = useQuery({
    queryKey: ['inventory', 'stocks', pointOfSaleId],
    queryFn: () => inventoryApi.stocks(baseParams),
    enabled: Boolean(pointOfSaleId),
  });
  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['inventory', 'entries', entryParams],
    queryFn: () => inventoryApi.entries(entryParams),
    enabled: Boolean(pointOfSaleId),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products', 'inventory-entry', pointOfSaleId],
    queryFn: () => productsApi.list({ ...baseParams, isActive: true }),
    enabled: Boolean(pointOfSaleId),
  });
  const { data: adjustmentProducts = [], isLoading: adjustmentProductsLoading } = useQuery({
    queryKey: ['products', 'inventory-adjustment', adjustmentPointOfSaleId],
    queryFn: () => productsApi.list({ pointOfSaleId: adjustmentPointOfSaleId, isActive: true }),
    enabled: isAdmin && adjustmentModalOpen && Boolean(adjustmentPointOfSaleId),
  });

  const pointName = isAdmin ? points.find((point) => point.id === pointOfSaleId)?.name : user?.pointOfSale?.name;
  const productOptions = products.map((product) => ({
    value: product.id,
    label: `${product.description} - existencia ${product.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}`,
  }));
  const totalUnits = stocks.reduce((sum, stock) => sum + stock.quantity, 0);
  const outOfStock = stocks.filter((stock) => stock.isActive && stock.quantity <= 0).length;

  const create = useMutation({
    mutationFn: inventoryApi.createEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast('Entrada de mercancía registrada');
      setModalOpen(false);
    },
    onError: (err) => setError(getApiError(err, 'No se pudo registrar la entrada')),
  });

  const adjust = useMutation({
    mutationFn: inventoryApi.adjustStock,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setPointOfSaleId(variables.pointOfSaleId);
      toast(`Inventario ${variables.operation === 'ADD' ? 'aumentado' : 'disminuido'} correctamente`);
      setAdjustmentModalOpen(false);
    },
    onError: (err) => setAdjustmentError(getApiError(err, 'No se pudo realizar el ajuste')),
  });

  const openCreate = () => {
    setSupplierName('');
    setRemittanceNumber('');
    setEntryDate(today());
    setObservations('');
    setLines([emptyLine()]);
    setError('');
    setModalOpen(true);
  };

  const openAdjustment = () => {
    setAdjustmentPointOfSaleId(pointOfSaleId || points.find((point) => point.isActive)?.id || '');
    setAdjustmentProductId('');
    setAdjustmentOperation('ADD');
    setAdjustmentQuantity('1');
    setAdjustmentError('');
    setAdjustmentModalOpen(true);
  };

  const setFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const updateLine = (index: number, patch: Partial<EntryLine>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!pointOfSaleId) return setError('Selecciona un punto de venta');
    if (lines.some((line) => !line.productId)) return setError('Selecciona un producto en cada línea');
    if (new Set(lines.map((line) => line.productId)).size !== lines.length) return setError('No repitas productos en la entrada');
    await create.mutateAsync({
      pointOfSaleId,
      supplierName,
      remittanceNumber,
      entryDate,
      observations,
      items: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
    });
  }

  async function exportStocks(kind: 'excel' | 'pdf') {
    if (!pointOfSaleId) return;
    setExporting(kind);
    try {
      const blob = kind === 'excel'
        ? await inventoryApi.exportStocksExcel(baseParams)
        : await inventoryApi.exportStocksPdf(baseParams);
      const safePointName = (pointName || 'bodega').replace(/[\\/:*?"<>|]/g, '-');
      downloadBlob(blob, `Existencias - ${safePointName}.${kind === 'excel' ? 'xlsx' : 'pdf'}`);
    } catch {
      toast('No se pudo generar el reporte de existencias', 'error');
    } finally {
      setExporting(null);
    }
  }

  async function submitAdjustment(event: FormEvent) {
    event.preventDefault();
    setAdjustmentError('');
    if (!adjustmentPointOfSaleId) return setAdjustmentError('Selecciona una bodega');
    if (!adjustmentProductId) return setAdjustmentError('Selecciona un producto');
    const quantity = Number(adjustmentQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return setAdjustmentError('Ingresa una cantidad válida');
    await adjust.mutateAsync({
      pointOfSaleId: adjustmentPointOfSaleId,
      productId: adjustmentProductId,
      operation: adjustmentOperation,
      quantity,
    });
  }

  const adjustmentProduct = adjustmentProducts.find((product) => product.id === adjustmentProductId);
  const adjustmentAmount = Number(adjustmentQuantity) || 0;
  const resultingQuantity = adjustmentProduct
    ? adjustmentProduct.quantity + (adjustmentOperation === 'ADD' ? adjustmentAmount : -adjustmentAmount)
    : null;
  const adjustmentProductOptions = adjustmentProducts.map((product) => ({
    value: product.id,
    label: `${product.description} - existencia ${product.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}`,
  }));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Inventario</h1><p className="text-sm text-mute">Existencias y entradas de mercancía por punto de venta.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => exportStocks('excel')} disabled={!pointOfSaleId || Boolean(exporting)}><Download className="h-4 w-4" /> {exporting === 'excel' ? 'Generando...' : 'Excel'}</Button>
          <Button variant="secondary" onClick={() => exportStocks('pdf')} disabled={!pointOfSaleId || Boolean(exporting)}><FileText className="h-4 w-4" /> {exporting === 'pdf' ? 'Generando...' : 'PDF'}</Button>
          {isAdmin && <Button variant="secondary" onClick={openAdjustment}><ArrowLeftRight className="h-4 w-4" /> Ajustar inventario</Button>}
          {isAdmin && <Button onClick={openCreate} disabled={!pointOfSaleId}><PackagePlus className="h-4 w-4" /> Nueva entrada</Button>}
        </div>
      </div>

      <Card className="p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {isAdmin ? <Field label="Punto de venta"><Select value={pointOfSaleId} onChange={(event) => { setPointOfSaleId(event.target.value); setPage(1); }}><option value="">Selecciona</option>{points.filter((point) => point.isActive).map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}</Select></Field> : <Field label="Punto de venta"><Input disabled value={pointName || 'Sin asignar'} /></Field>}
        <Field label="Desde"><Input type="date" value={filters.fromDate} onChange={(event) => setFilter('fromDate', event.target.value)} /></Field>
        <Field label="Hasta"><Input type="date" value={filters.toDate} onChange={(event) => setFilter('toDate', event.target.value)} /></Field>
        <Field label="Buscar entradas"><div className="relative"><Input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Proveedor, remisión o producto" className="pl-9" /><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" /></div></Field>
      </div></Card>

      {!pointOfSaleId ? <EmptyState title="Selecciona un punto de venta" /> : stocksLoading ? <Spinner /> : <>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4"><p className="text-xs font-semibold uppercase text-mute">Referencias</p><p className="mt-2 text-2xl font-bold text-brand-dark">{stocks.length}</p></Card>
          <Card className="p-4"><p className="text-xs font-semibold uppercase text-mute">Unidades disponibles</p><p className="mt-2 text-2xl font-bold text-brand-dark">{totalUnits.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</p></Card>
          <Card className="p-4"><p className="text-xs font-semibold uppercase text-mute">Sin existencia</p><p className={`mt-2 text-2xl font-bold ${outOfStock ? 'text-expense' : 'text-brand-dark'}`}>{outOfStock}</p></Card>
        </div>

        <Card className="overflow-hidden p-0"><div className="flex items-center gap-2 border-b border-line px-4 py-3"><Boxes className="h-4 w-4 text-brand" /><h2 className="font-bold">Existencias actuales - {pointName}</h2></div><div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[620px] text-sm"><thead className="sticky top-0 bg-paper text-left text-xs uppercase text-mute"><tr><th className="px-4 py-3">Producto</th><th className="px-4 py-3 text-right">Existencia</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-line">{stocks.map((stock) => <tr key={stock.id}><td className="px-4 py-3 font-semibold">{stock.productDescription}</td><td className={`px-4 py-3 text-right font-bold ${stock.quantity <= 0 ? 'text-expense' : 'text-brand-dark'}`}>{stock.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</td><td className="px-4 py-3">{stock.isActive ? 'Activo' : 'Inactivo'}</td></tr>)}</tbody></table>{!stocks.length && <p className="p-6 text-center text-sm text-mute">No hay productos asignados.</p>}</div></Card>
      </>}

      {pointOfSaleId && <Card className="overflow-hidden p-0"><div className="border-b border-line px-4 py-3"><h2 className="font-bold">Historial de entradas</h2></div>{entriesLoading || !entries ? <div className="p-6"><Spinner /></div> : entries.data.length ? <><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-paper text-left text-xs uppercase text-mute"><tr><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Remisión</th><th className="px-4 py-3">Productos</th><th className="px-4 py-3">Usuario</th></tr></thead><tbody className="divide-y divide-line">{entries.data.map((entry) => <tr key={entry.id}><td className="px-4 py-3 font-mono font-semibold">{entry.documentNumber}</td><td className="px-4 py-3">{dateInput(entry.entryDate)}</td><td className="px-4 py-3 font-semibold">{entry.supplierName}</td><td className="px-4 py-3">{entry.remittanceNumber || '-'}</td><td className="px-4 py-3"><ul className="space-y-1">{entry.items.map((item) => <li key={item.id}>{item.productDescription} <span className="font-bold text-brand-dark">+{item.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</span></li>)}</ul></td><td className="px-4 py-3">{entry.user?.name || '-'}</td></tr>)}</tbody></table></div><div className="p-4"><Pagination page={entries.page} pageSize={entries.pageSize} total={entries.total} onChange={setPage} /></div></> : <EmptyState title="Sin entradas registradas" />}</Card>}

      <Modal open={isAdmin && modalOpen} onClose={() => setModalOpen(false)} title="Nueva entrada de mercancía" size="large">
        <form onSubmit={submit} className="space-y-4">
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm">La entrada aumentará el inventario de <strong>{pointName}</strong>.</p>
          <div className="grid gap-3 sm:grid-cols-3"><Field label="Proveedor"><Input required minLength={2} maxLength={191} value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Nombre del proveedor" /></Field><Field label="Remisión" hint="Opcional"><Input maxLength={191} value={remittanceNumber} onChange={(event) => setRemittanceNumber(event.target.value)} /></Field><Field label="Fecha"><Input required type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} /></Field></div>
          <Field label="Observaciones" hint="Opcional"><textarea className="input min-h-20 resize-y" maxLength={1000} value={observations} onChange={(event) => setObservations(event.target.value)} /></Field>
          <div className="space-y-3"><div className="flex items-center justify-between"><p className="font-bold">Productos recibidos</p><Button variant="secondary" className="px-3 py-1.5" onClick={() => setLines((current) => [...current, emptyLine()])}><PackagePlus className="h-4 w-4" /> Agregar</Button></div>{lines.map((line, index) => <div key={index} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_180px_auto]"><Field label={`Producto ${index + 1}`}><SearchableSelect value={line.productId} onChange={(productId) => updateLine(index, { productId })} options={productOptions} placeholder="Buscar producto" emptyMessage="No hay productos activos" /></Field><Field label="Cantidad"><Input required type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} /></Field><div className="flex items-end"><Button variant="ghost" className="px-2 text-expense" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>
          {!products.length && <p className="flex items-center gap-2 rounded-lg bg-expense-soft px-3 py-2 text-sm text-expense"><TriangleAlert className="h-4 w-4" /> No hay productos activos para registrar una entrada.</p>}
          {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={create.isPending || !products.length}>{create.isPending ? 'Guardando...' : 'Registrar entrada'}</Button></div>
        </form>
      </Modal>

      <Modal open={isAdmin && adjustmentModalOpen} onClose={() => setAdjustmentModalOpen(false)} title="Ajustar inventario">
        <form onSubmit={submitAdjustment} className="space-y-4">
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm">El ajuste quedará registrado con tu usuario y el saldo final del producto.</p>
          <Field label="Bodega / punto de venta">
            <Select value={adjustmentPointOfSaleId} onChange={(event) => { setAdjustmentPointOfSaleId(event.target.value); setAdjustmentProductId(''); setAdjustmentError(''); }}>
              <option value="">Selecciona</option>
              {points.filter((point) => point.isActive).map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}
            </Select>
          </Field>
          <Field label="Producto">
            <SearchableSelect value={adjustmentProductId} onChange={setAdjustmentProductId} options={adjustmentProductOptions} disabled={!adjustmentPointOfSaleId || adjustmentProductsLoading} placeholder={adjustmentProductsLoading ? 'Cargando productos...' : 'Buscar producto'} emptyMessage="No hay productos activos" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de ajuste"><Select value={adjustmentOperation} onChange={(event) => setAdjustmentOperation(event.target.value as 'ADD' | 'SUBTRACT')}><option value="ADD">Sumar al inventario</option><option value="SUBTRACT">Restar del inventario</option></Select></Field>
            <Field label="Cantidad"><Input required type="number" min="0.001" step="0.001" value={adjustmentQuantity} onChange={(event) => setAdjustmentQuantity(event.target.value)} /></Field>
          </div>
          {adjustmentProduct && resultingQuantity !== null && <div className={`rounded-lg px-3 py-3 text-sm ${resultingQuantity < 0 ? 'bg-expense-soft text-expense' : 'bg-paper text-ink'}`}><p>Existencia actual: <strong>{adjustmentProduct.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</strong></p><p>Existencia después del ajuste: <strong>{resultingQuantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</strong></p>{resultingQuantity < 0 && <p className="mt-1 font-semibold">La existencia no puede quedar negativa.</p>}</div>}
          {adjustmentError && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{adjustmentError}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setAdjustmentModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={adjust.isPending || !adjustmentProductId || resultingQuantity === null || resultingQuantity < 0}>{adjust.isPending ? 'Guardando...' : 'Aplicar ajuste'}</Button></div>
        </form>
      </Modal>
    </section>
  );
}
