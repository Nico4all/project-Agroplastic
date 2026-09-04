import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Ban, Boxes, Download, FileSpreadsheet, FileText, History, PackagePlus, Pencil, Search, SlidersHorizontal, Trash2, TriangleAlert, Truck } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { inventoryApi, pointsOfSaleApi, productsApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Pagination, SearchableSelect, Select, Spinner, useToast } from '../ui/components';
import { InventoryAdjustment } from '../types';
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

function movementLabel(type: string) {
  return ({ ENTRY: 'Entrada', ORDER: 'Pedido', ORDER_VOID: 'Anulación', ADJUSTMENT_ADD: 'Ajuste +', ADJUSTMENT_SUBTRACT: 'Ajuste -', ADJUSTMENT_EDIT: 'Edición ajuste', ADJUSTMENT_VOID: 'Anulación ajuste', TRANSFER_IN: 'Traslado entrada', TRANSFER_OUT: 'Traslado salida' } as Record<string, string>)[type] || type;
}

function movementTone(type: string): 'income' | 'expense' | 'transfer' | 'neutral' {
  if (['ENTRY', 'ORDER_VOID', 'ADJUSTMENT_ADD', 'TRANSFER_IN'].includes(type)) return 'income';
  if (['ADJUSTMENT_SUBTRACT', 'ADJUSTMENT_VOID', 'TRANSFER_OUT'].includes(type)) return 'expense';
  return type === 'ORDER' ? 'neutral' : 'transfer';
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
  const [adjustmentObservation, setAdjustmentObservation] = useState('');
  const [adjustmentError, setAdjustmentError] = useState('');
  const [adjustmentPage, setAdjustmentPage] = useState(1);
  const [editingAdjustment, setEditingAdjustment] = useState<InventoryAdjustment | null>(null);
  const [voidingAdjustment, setVoidingAdjustment] = useState<InventoryAdjustment | null>(null);
  const [adjustmentVoidReason, setAdjustmentVoidReason] = useState('');
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferOriginId, setTransferOriginId] = useState('');
  const [transferDestinationId, setTransferDestinationId] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('1');
  const [transferObservation, setTransferObservation] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferPage, setTransferPage] = useState(1);
  const [historyProductId, setHistoryProductId] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyDates, setHistoryDates] = useState({ fromDate: '', toDate: '' });
  const [historyExporting, setHistoryExporting] = useState(false);
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
  const { data: transferProducts = [], isLoading: transferProductsLoading } = useQuery({
    queryKey: ['products', 'inventory-transfer', transferOriginId],
    queryFn: () => productsApi.list({ pointOfSaleId: transferOriginId, isActive: true }),
    enabled: isAdmin && transferModalOpen && Boolean(transferOriginId),
  });
  const adjustmentParams = useMemo(() => ({ page: adjustmentPage, pageSize: 8, ...baseParams }), [adjustmentPage, baseParams]);
  const transferParams = useMemo(() => ({ page: transferPage, pageSize: 8, ...baseParams }), [transferPage, baseParams]);
  const { data: adjustments, isLoading: adjustmentsLoading } = useQuery({
    queryKey: ['inventory', 'adjustments', adjustmentParams],
    queryFn: () => inventoryApi.adjustments(adjustmentParams),
    enabled: Boolean(pointOfSaleId),
  });
  const { data: transfers, isLoading: transfersLoading } = useQuery({
    queryKey: ['inventory', 'transfers', transferParams],
    queryFn: () => inventoryApi.transfers(transferParams),
    enabled: Boolean(pointOfSaleId),
  });
  const { data: historyProducts = [] } = useQuery({
    queryKey: ['products', 'inventory-history', pointOfSaleId],
    queryFn: () => productsApi.list(baseParams),
    enabled: Boolean(pointOfSaleId),
  });
  const historyParams = useMemo(
    () => Object.fromEntries(Object.entries({ page: historyPage, pageSize: 15, ...baseParams, productId: historyProductId, ...historyDates }).filter(([, value]) => value !== '')),
    [historyPage, baseParams, historyProductId, historyDates],
  );
  const { data: productHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['inventory', 'product-history', historyParams],
    queryFn: () => inventoryApi.productHistory(historyParams),
    enabled: Boolean(pointOfSaleId && historyProductId),
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
    onSuccess: (adjustment, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setPointOfSaleId(variables.pointOfSaleId);
      toast(`Ajuste ${adjustment.documentNumber} registrado`);
      setAdjustmentModalOpen(false);
    },
    onError: (err) => setAdjustmentError(getApiError(err, 'No se pudo realizar el ajuste')),
  });

  const updateAdjustment = useMutation({
    mutationFn: ({ id, quantity, observation }: { id: string; quantity: number; observation?: string }) =>
      inventoryApi.updateAdjustment(id, { quantity, observation }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast(`Ajuste ${updated.documentNumber} actualizado`);
      setAdjustmentModalOpen(false);
      setEditingAdjustment(null);
    },
    onError: (err) => setAdjustmentError(getApiError(err, 'No se pudo editar el ajuste')),
  });

  const voidAdjustment = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => inventoryApi.voidAdjustment(id, { reason }),
    onSuccess: (voided) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast(`Ajuste ${voided.documentNumber} anulado`);
      setVoidingAdjustment(null);
      setAdjustmentVoidReason('');
    },
    onError: (err) => toast(getApiError(err, 'No se pudo anular el ajuste'), 'error'),
  });

  const transfer = useMutation({
    mutationFn: inventoryApi.createTransfer,
    onSuccess: (created, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setPointOfSaleId(variables.originPointOfSaleId);
      toast(`Traslado ${created.documentNumber} registrado`);
      setTransferModalOpen(false);
    },
    onError: (err) => setTransferError(getApiError(err, 'No se pudo realizar el traslado')),
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
    setEditingAdjustment(null);
    setAdjustmentPointOfSaleId(pointOfSaleId || points.find((point) => point.isActive)?.id || '');
    setAdjustmentProductId('');
    setAdjustmentOperation('ADD');
    setAdjustmentQuantity('1');
    setAdjustmentObservation('');
    setAdjustmentError('');
    setAdjustmentModalOpen(true);
  };

  const openEditAdjustment = (adjustment: InventoryAdjustment) => {
    setEditingAdjustment(adjustment);
    setAdjustmentPointOfSaleId(adjustment.pointOfSaleId);
    setAdjustmentProductId(adjustment.productId);
    setAdjustmentOperation(adjustment.operation);
    setAdjustmentQuantity(String(adjustment.quantity));
    setAdjustmentObservation(adjustment.observation || '');
    setAdjustmentError('');
    setAdjustmentModalOpen(true);
  };

  const openTransfer = () => {
    const origin = pointOfSaleId || points.find((point) => point.isActive)?.id || '';
    setTransferOriginId(origin);
    setTransferDestinationId(points.find((point) => point.isActive && point.id !== origin)?.id || '');
    setTransferProductId('');
    setTransferQuantity('1');
    setTransferObservation('');
    setTransferError('');
    setTransferModalOpen(true);
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
    if (editingAdjustment) {
      await updateAdjustment.mutateAsync({ id: editingAdjustment.id, quantity, observation: adjustmentObservation });
    } else {
      await adjust.mutateAsync({
        pointOfSaleId: adjustmentPointOfSaleId,
        productId: adjustmentProductId,
        operation: adjustmentOperation,
        quantity,
        observation: adjustmentObservation,
      });
    }
  }

  async function submitTransfer(event: FormEvent) {
    event.preventDefault();
    setTransferError('');
    if (!transferOriginId || !transferDestinationId) return setTransferError('Selecciona las bodegas de origen y destino');
    if (transferOriginId === transferDestinationId) return setTransferError('Las bodegas de origen y destino deben ser diferentes');
    if (!transferProductId) return setTransferError('Selecciona un producto');
    const quantity = Number(transferQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return setTransferError('Ingresa una cantidad válida');
    await transfer.mutateAsync({
      originPointOfSaleId: transferOriginId,
      destinationPointOfSaleId: transferDestinationId,
      productId: transferProductId,
      quantity,
      observation: transferObservation,
    });
  }

  const adjustmentProduct = adjustmentProducts.find((product) => product.id === adjustmentProductId);
  const adjustmentStock = stocks.find((stock) => stock.productId === adjustmentProductId);
  const adjustmentAmount = Number(adjustmentQuantity) || 0;
  const currentAdjustmentStock = editingAdjustment ? adjustmentStock?.quantity : adjustmentProduct?.quantity;
  const previousAdjustmentAmount = editingAdjustment
    ? (editingAdjustment.operation === 'ADD' ? editingAdjustment.quantity : -editingAdjustment.quantity)
    : 0;
  const nextAdjustmentAmount = adjustmentOperation === 'ADD' ? adjustmentAmount : -adjustmentAmount;
  const resultingQuantity = currentAdjustmentStock !== undefined
    ? currentAdjustmentStock + nextAdjustmentAmount - previousAdjustmentAmount
    : null;
  const adjustmentProductOptions = adjustmentProducts.map((product) => ({
    value: product.id,
    label: `${product.description} - existencia ${product.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}`,
  }));
  const transferProduct = transferProducts.find((product) => product.id === transferProductId);
  const transferAmount = Number(transferQuantity) || 0;
  const transferProductOptions = transferProducts.map((product) => ({
    value: product.id,
    label: `${product.description} - existencia ${product.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}`,
  }));
  const historyProductOptions = historyProducts.map((product) => ({
    value: product.id,
    label: `${product.description} - existencia ${product.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}${product.isActive ? '' : ' - inactivo'}`,
  }));

  async function exportProductHistory() {
    if (!historyProductId) return;
    setHistoryExporting(true);
    try {
      const blob = await inventoryApi.exportProductHistoryExcel({ ...baseParams, productId: historyProductId, ...historyDates });
      const productName = historyProducts.find((product) => product.id === historyProductId)?.description || 'producto';
      const safeName = productName.replace(/[\\/:*?"<>|]/g, '-');
      downloadBlob(blob, `Histórico - ${safeName} - ${pointName || 'bodega'}.xlsx`);
    } catch {
      toast('No se pudo generar el histórico del producto', 'error');
    } finally {
      setHistoryExporting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Inventario</h1><p className="text-sm text-mute">Existencias, entradas, ajustes y traslados por punto de venta.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => exportStocks('excel')} disabled={!pointOfSaleId || Boolean(exporting)}><Download className="h-4 w-4" /> {exporting === 'excel' ? 'Generando...' : 'Excel'}</Button>
          <Button variant="secondary" onClick={() => exportStocks('pdf')} disabled={!pointOfSaleId || Boolean(exporting)}><FileText className="h-4 w-4" /> {exporting === 'pdf' ? 'Generando...' : 'PDF'}</Button>
          {isAdmin && <Button variant="secondary" onClick={openTransfer}><ArrowLeftRight className="h-4 w-4" /> Nuevo traslado</Button>}
          {isAdmin && <Button variant="secondary" onClick={openAdjustment}><SlidersHorizontal className="h-4 w-4" /> Ajustar inventario</Button>}
          {isAdmin && <Button onClick={openCreate} disabled={!pointOfSaleId}><PackagePlus className="h-4 w-4" /> Nueva entrada</Button>}
        </div>
      </div>

      <Card className="p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {isAdmin ? <Field label="Punto de venta"><Select value={pointOfSaleId} onChange={(event) => { setPointOfSaleId(event.target.value); setPage(1); setAdjustmentPage(1); setTransferPage(1); setHistoryProductId(''); setHistoryPage(1); }}><option value="">Selecciona</option>{points.filter((point) => point.isActive).map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}</Select></Field> : <Field label="Punto de venta"><Input disabled value={pointName || 'Sin asignar'} /></Field>}
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

      {pointOfSaleId && <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <SlidersHorizontal className="h-4 w-4 text-brand" />
          <div><h2 className="font-bold">Ajustes de inventario</h2><p className="text-xs text-mute">Documentos consecutivos aplicados en {pointName}.</p></div>
        </div>
        {adjustmentsLoading || !adjustments ? <div className="p-6"><Spinner /></div> : adjustments.data.length ? <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px] text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-mute">
                <tr>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Operación</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">Antes</th>
                  <th className="px-4 py-3 text-right">Después</th>
                  <th className="px-4 py-3">Observación</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {adjustments.data.map((adjustment) => (
                  <tr key={adjustment.id} className={adjustment.status === 'VOID' ? 'bg-expense-soft/25' : ''}>
                    <td className="px-4 py-3 font-mono font-semibold">{adjustment.documentNumber}</td>
                    <td className="px-4 py-3">{dateInput(adjustment.adjustmentDate)}</td>
                    <td className="px-4 py-3 font-semibold">{adjustment.product?.description || '-'}</td>
                    <td className="px-4 py-3"><Badge tone={adjustment.operation === 'ADD' ? 'income' : 'expense'}>{adjustment.operation === 'ADD' ? 'Suma' : 'Resta'}</Badge></td>
                    <td className={`px-4 py-3 text-right font-bold ${adjustment.status === 'VOID' ? 'text-mute line-through' : adjustment.operation === 'ADD' ? 'text-brand-dark' : 'text-expense'}`}>{adjustment.operation === 'ADD' ? '+' : '-'}{adjustment.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</td>
                    <td className="px-4 py-3 text-right">{adjustment.balanceBefore.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</td>
                    <td className="px-4 py-3 text-right font-semibold">{adjustment.balanceAfter.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</td>
                    <td className="max-w-[260px] px-4 py-3">{adjustment.status === 'VOID' && adjustment.voidReason ? <><span className="font-semibold text-expense">Anulado: </span>{adjustment.voidReason}</> : adjustment.observation || '-'}</td>
                    <td className="px-4 py-3">{adjustment.user?.name || '-'}</td>
                    <td className="px-4 py-3"><Badge tone={adjustment.status === 'VOID' ? 'expense' : 'income'}>{adjustment.status === 'VOID' ? 'Anulado' : 'Activo'}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {isAdmin && adjustment.status === 'ACTIVE' && <>
                          <Button variant="ghost" className="px-2" title="Editar cantidad" onClick={() => openEditAdjustment(adjustment)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" className="px-2 text-expense" title="Anular ajuste" onClick={() => { setVoidingAdjustment(adjustment); setAdjustmentVoidReason(''); }}><Ban className="h-4 w-4" /></Button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4"><Pagination page={adjustments.page} pageSize={adjustments.pageSize} total={adjustments.total} onChange={setAdjustmentPage} /></div>
        </> : <EmptyState title="Sin ajustes registrados" />}
      </Card>}

      {pointOfSaleId && <Card className="overflow-hidden p-0"><div className="flex items-center gap-2 border-b border-line px-4 py-3"><Truck className="h-4 w-4 text-brand" /><div><h2 className="font-bold">Traslados de inventario</h2><p className="text-xs text-mute">Movimientos donde {pointName} participa como origen o destino.</p></div></div>{transfersLoading || !transfers ? <div className="p-6"><Spinner /></div> : transfers.data.length ? <><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-sm"><thead className="bg-paper text-left text-xs uppercase text-mute"><tr><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Origen → destino</th><th className="px-4 py-3">Producto</th><th className="px-4 py-3 text-right">Cantidad</th><th className="px-4 py-3">Saldo origen</th><th className="px-4 py-3">Saldo destino</th><th className="px-4 py-3">Observación</th><th className="px-4 py-3">Usuario</th></tr></thead><tbody className="divide-y divide-line">{transfers.data.map((movement) => <tr key={movement.id}><td className="px-4 py-3 font-mono font-semibold">{movement.documentNumber}</td><td className="px-4 py-3">{dateInput(movement.transferDate)}</td><td className="px-4 py-3 font-semibold">{movement.originPointOfSale?.name || '-'} <span className="text-mute">→</span> {movement.destinationPointOfSale?.name || '-'}</td><td className="px-4 py-3 font-semibold">{movement.product?.description || '-'}</td><td className="px-4 py-3 text-right font-bold">{movement.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</td><td className="px-4 py-3">{movement.originBalanceBefore.toLocaleString('es-CO', { maximumFractionDigits: 3 })} → <strong>{movement.originBalanceAfter.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</strong></td><td className="px-4 py-3">{movement.destinationBalanceBefore.toLocaleString('es-CO', { maximumFractionDigits: 3 })} → <strong>{movement.destinationBalanceAfter.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</strong></td><td className="max-w-[260px] px-4 py-3">{movement.observation || '-'}</td><td className="px-4 py-3">{movement.user?.name || '-'}</td></tr>)}</tbody></table></div><div className="p-4"><Pagination page={transfers.page} pageSize={transfers.pageSize} total={transfers.total} onChange={setTransferPage} /></div></> : <EmptyState title="Sin traslados registrados" />}</Card>}

      {pointOfSaleId && <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3"><div className="flex items-center gap-2"><History className="h-4 w-4 text-brand" /><div><h2 className="font-bold">Histórico por producto</h2><p className="text-xs text-mute">Entradas, pedidos, ajustes y traslados con inventario antes y después.</p></div></div><Button variant="secondary" disabled={!historyProductId || historyExporting} onClick={exportProductHistory}><FileSpreadsheet className="h-4 w-4" /> {historyExporting ? 'Generando...' : 'Excel'}</Button></div>
        <div className="grid gap-3 border-b border-line p-4 md:grid-cols-3"><Field label="Producto"><SearchableSelect value={historyProductId} onChange={(value) => { setHistoryProductId(value); setHistoryPage(1); }} options={historyProductOptions} placeholder="Buscar producto" emptyMessage="No hay productos en esta bodega" /></Field><Field label="Desde"><Input type="date" value={historyDates.fromDate} onChange={(event) => { setHistoryDates((current) => ({ ...current, fromDate: event.target.value })); setHistoryPage(1); }} /></Field><Field label="Hasta"><Input type="date" value={historyDates.toDate} onChange={(event) => { setHistoryDates((current) => ({ ...current, toDate: event.target.value })); setHistoryPage(1); }} /></Field></div>
        {!historyProductId ? <EmptyState title="Selecciona un producto para consultar sus movimientos" /> : historyLoading || !productHistory ? <div className="p-6"><Spinner /></div> : <>
          <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-lg bg-paper p-3"><p className="text-xs font-semibold uppercase text-mute">Movimientos</p><p className="mt-1 text-xl font-bold text-brand-dark">{productHistory.summary.movements}</p><p className="text-xs text-mute">{productHistory.summary.entries} entradas · {productHistory.summary.orders} pedidos · {productHistory.summary.adjustments} ajustes · {productHistory.summary.transfers} traslados</p></div><div className="rounded-lg bg-paper p-3"><p className="text-xs font-semibold uppercase text-mute">Entradas al inventario</p><p className="mt-1 text-xl font-bold text-brand-dark">+{productHistory.summary.totalInput.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</p></div><div className="rounded-lg bg-paper p-3"><p className="text-xs font-semibold uppercase text-mute">Salidas del inventario</p><p className="mt-1 text-xl font-bold text-expense">-{productHistory.summary.totalOutput.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</p></div><div className="rounded-lg bg-paper p-3"><p className="text-xs font-semibold uppercase text-mute">Inventario actual</p><p className="mt-1 text-xl font-bold text-brand-dark">{productHistory.summary.currentInventory.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</p></div></div>
          {productHistory.data.length ? <><div className="overflow-x-auto"><table className="w-full min-w-[1280px] text-sm"><thead className="bg-paper text-left text-xs uppercase text-mute"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Tercero / bodega</th><th className="px-4 py-3 text-right">Inventario antes</th><th className="px-4 py-3 text-right">Entrada</th><th className="px-4 py-3 text-right">Salida</th><th className="px-4 py-3 text-right">Inventario después</th><th className="px-4 py-3">Detalle</th><th className="px-4 py-3">Usuario</th></tr></thead><tbody className="divide-y divide-line">{productHistory.data.map((movement) => <tr key={movement.id}><td className="px-4 py-3">{dateInput(movement.date)}</td><td className="px-4 py-3"><Badge tone={movementTone(movement.movementType)}>{movementLabel(movement.movementType)}</Badge></td><td className="px-4 py-3 font-mono font-semibold">{movement.documentNumber}</td><td className="px-4 py-3"><p className="font-semibold">{movement.thirdPartyName}</p>{movement.thirdPartyDocument && <p className="text-xs text-mute">{movement.thirdPartyDocument}</p>}</td><td className="px-4 py-3 text-right font-semibold">{movement.inventoryBefore.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</td><td className="px-4 py-3 text-right font-bold text-brand-dark">{movement.quantityInput ? `+${movement.quantityInput.toLocaleString('es-CO', { maximumFractionDigits: 3 })}` : '-'}</td><td className="px-4 py-3 text-right font-bold text-expense">{movement.quantityOutput ? `-${movement.quantityOutput.toLocaleString('es-CO', { maximumFractionDigits: 3 })}` : '-'}</td><td className="px-4 py-3 text-right font-semibold text-brand-dark">{movement.inventoryAfter.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</td><td className="px-4 py-3">{movement.detail}</td><td className="px-4 py-3">{movement.userName}</td></tr>)}</tbody></table></div><div className="p-4"><Pagination page={productHistory.page} pageSize={productHistory.pageSize} total={productHistory.total} onChange={setHistoryPage} /></div></> : <EmptyState title="Este producto no tiene movimientos en el periodo" />}
        </>}
      </Card>}

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

      <Modal
        open={isAdmin && adjustmentModalOpen}
        onClose={() => { setAdjustmentModalOpen(false); setEditingAdjustment(null); }}
        title={editingAdjustment ? `Editar ajuste ${editingAdjustment.documentNumber}` : 'Ajustar inventario'}
      >
        <form onSubmit={submitAdjustment} className="space-y-4">
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm">
            {editingAdjustment
              ? 'Al guardar, el sistema aplicará solamente la diferencia frente a la cantidad registrada y conservará el historial.'
              : 'El ajuste quedará registrado con tu usuario y el saldo final del producto.'}
          </p>
          <Field label="Bodega / punto de venta">
            <Select disabled={Boolean(editingAdjustment)} value={adjustmentPointOfSaleId} onChange={(event) => { setAdjustmentPointOfSaleId(event.target.value); setAdjustmentProductId(''); setAdjustmentError(''); }}>
              <option value="">Selecciona</option>
              {points.filter((point) => point.isActive).map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}
            </Select>
          </Field>
          <Field label="Producto">
            {editingAdjustment
              ? <Input disabled value={editingAdjustment.product?.description || adjustmentStock?.productDescription || '-'} />
              : <SearchableSelect value={adjustmentProductId} onChange={setAdjustmentProductId} options={adjustmentProductOptions} disabled={!adjustmentPointOfSaleId || adjustmentProductsLoading} placeholder={adjustmentProductsLoading ? 'Cargando productos...' : 'Buscar producto'} emptyMessage="No hay productos activos" />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de ajuste"><Select disabled={Boolean(editingAdjustment)} value={adjustmentOperation} onChange={(event) => setAdjustmentOperation(event.target.value as 'ADD' | 'SUBTRACT')}><option value="ADD">Sumar al inventario</option><option value="SUBTRACT">Restar del inventario</option></Select></Field>
            <Field label="Cantidad"><Input required type="number" min="0.001" step="0.001" value={adjustmentQuantity} onChange={(event) => setAdjustmentQuantity(event.target.value)} /></Field>
          </div>
          <Field label="Observación" hint="Opcional"><textarea className="input min-h-20 resize-y" maxLength={1000} value={adjustmentObservation} onChange={(event) => setAdjustmentObservation(event.target.value)} placeholder="Motivo o soporte del ajuste" /></Field>
          {currentAdjustmentStock !== undefined && resultingQuantity !== null && <div className={`rounded-lg px-3 py-3 text-sm ${resultingQuantity < 0 ? 'bg-expense-soft text-expense' : 'bg-paper text-ink'}`}>
            {editingAdjustment && <p>Cantidad registrada: <strong>{editingAdjustment.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</strong></p>}
            <p>Existencia actual: <strong>{currentAdjustmentStock.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</strong></p>
            <p>Existencia después del ajuste: <strong>{resultingQuantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</strong></p>
            {resultingQuantity < 0 && <p className="mt-1 font-semibold">La existencia no puede quedar negativa.</p>}
          </div>}
          {adjustmentError && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{adjustmentError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={adjust.isPending || updateAdjustment.isPending} onClick={() => { setAdjustmentModalOpen(false); setEditingAdjustment(null); }}>Cancelar</Button>
            <Button type="submit" disabled={adjust.isPending || updateAdjustment.isPending || !adjustmentProductId || resultingQuantity === null || resultingQuantity < 0}>
              {adjust.isPending || updateAdjustment.isPending ? 'Guardando...' : editingAdjustment ? 'Guardar cambios' : 'Aplicar ajuste'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={isAdmin && Boolean(voidingAdjustment)} onClose={() => { setVoidingAdjustment(null); setAdjustmentVoidReason(''); }} title="Anular ajuste de inventario">
        <div className="space-y-4">
          <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm text-expense">
            Esta acción revertirá del inventario el efecto vigente de <strong>{voidingAdjustment?.documentNumber}</strong>. El documento se conservará marcado como anulado.
          </p>
          <div className="rounded-lg bg-paper px-3 py-3 text-sm">
            <p>Producto: <strong>{voidingAdjustment?.product?.description || '-'}</strong></p>
            <p>Ajuste: <strong>{voidingAdjustment?.operation === 'ADD' ? '+' : '-'}{voidingAdjustment?.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</strong></p>
          </div>
          <Field label="Motivo de anulación" hint="Opcional">
            <textarea className="input min-h-20 resize-y" maxLength={191} value={adjustmentVoidReason} onChange={(event) => setAdjustmentVoidReason(event.target.value)} placeholder="Motivo de la anulación" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={voidAdjustment.isPending} onClick={() => { setVoidingAdjustment(null); setAdjustmentVoidReason(''); }}>Cancelar</Button>
            <Button variant="danger" disabled={voidAdjustment.isPending || !voidingAdjustment} onClick={() => voidingAdjustment && voidAdjustment.mutate({ id: voidingAdjustment.id, reason: adjustmentVoidReason })}>
              {voidAdjustment.isPending ? 'Anulando...' : 'Anular ajuste'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={isAdmin && transferModalOpen} onClose={() => setTransferModalOpen(false)} title="Nuevo traslado de inventario" size="large">
        <form onSubmit={submitTransfer} className="space-y-4">
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm">El traslado restará el producto de la bodega de origen y lo sumará en la bodega de destino en una sola operación.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bodega de origen"><Select value={transferOriginId} onChange={(event) => { const origin = event.target.value; setTransferOriginId(origin); setTransferProductId(''); if (transferDestinationId === origin) setTransferDestinationId(''); setTransferError(''); }}><option value="">Selecciona</option>{points.filter((point) => point.isActive).map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}</Select></Field>
            <Field label="Bodega de destino"><Select value={transferDestinationId} onChange={(event) => { setTransferDestinationId(event.target.value); setTransferError(''); }}><option value="">Selecciona</option>{points.filter((point) => point.isActive && point.id !== transferOriginId).map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}</Select></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Field label="Producto"><SearchableSelect value={transferProductId} onChange={setTransferProductId} options={transferProductOptions} disabled={!transferOriginId || transferProductsLoading} placeholder={transferProductsLoading ? 'Cargando productos...' : 'Buscar producto en origen'} emptyMessage="No hay productos activos en el origen" /></Field>
            <Field label="Cantidad"><Input required type="number" min="0.001" step="0.001" value={transferQuantity} onChange={(event) => setTransferQuantity(event.target.value)} /></Field>
          </div>
          {transferProduct && <div className={`rounded-lg px-3 py-3 text-sm ${transferAmount > transferProduct.quantity ? 'bg-expense-soft text-expense' : 'bg-paper text-ink'}`}><p>Existencia en origen: <strong>{transferProduct.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</strong></p><p>Existencia después del traslado: <strong>{(transferProduct.quantity - transferAmount).toLocaleString('es-CO', { maximumFractionDigits: 3 })}</strong></p>{transferAmount > transferProduct.quantity && <p className="mt-1 font-semibold">La cantidad supera la existencia disponible.</p>}</div>}
          <Field label="Observación" hint="Opcional"><textarea className="input min-h-20 resize-y" maxLength={1000} value={transferObservation} onChange={(event) => setTransferObservation(event.target.value)} placeholder="Motivo, transportador o referencia del traslado" /></Field>
          {transferError && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{transferError}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setTransferModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={transfer.isPending || !transferOriginId || !transferDestinationId || !transferProductId || transferAmount <= 0 || Boolean(transferProduct && transferAmount > transferProduct.quantity)}>{transfer.isPending ? 'Trasladando...' : 'Registrar traslado'}</Button></div>
        </form>
      </Modal>
    </section>
  );
}
