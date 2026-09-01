import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Eye, FileText, Plus, ReceiptText, Search, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { clientsApi, ordersApi, productsApi, usersApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { Order, OrderPaymentMethod } from '../types';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Pagination, SearchableSelect, Select, Spinner, useToast } from '../ui/components';
import { openBlob } from '../utils/download';
import { dateInput, money } from '../utils/format';
import { isAdminRole } from '../utils/roles';

type OrderLineForm = { productId: string; quantity: string; unitPrice: string };
type PaymentLineForm = { method: OrderPaymentMethod; amount: string };
const emptyLine = (): OrderLineForm => ({ productId: '', quantity: '1', unitPrice: '' });
const emptyPayment = (): PaymentLineForm => ({ method: 'CASH', amount: '' });

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

export function OrdersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = isAdminRole(user?.role);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', userId: '', status: '', search: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentLines, setPaymentLines] = useState<PaymentLineForm[]>([emptyPayment()]);
  const [observations, setObservations] = useState('');
  const [lines, setLines] = useState<OrderLineForm[]>([emptyLine()]);
  const [error, setError] = useState('');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [voiding, setVoiding] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const params = useMemo(
    () => Object.fromEntries(Object.entries({ page, pageSize: 15, ...filters }).filter(([, value]) => value !== '')),
    [page, filters],
  );
  const { data, isLoading } = useQuery({ queryKey: ['orders', params], queryFn: () => ordersApi.list(params) });
  const { data: clientsData } = useQuery({ queryKey: ['clients', 'order-form'], queryFn: () => clientsApi.list({ pageSize: 2000, isActive: true }) });
  const { data: products = [] } = useQuery({
    queryKey: ['products', 'order-form', user?.pointOfSaleId],
    queryFn: () => productsApi.list({ isActive: true, pointOfSaleId: user?.pointOfSaleId }),
    enabled: Boolean(user?.pointOfSaleId),
  });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: isAdmin });
  const clients = clientsData?.data || [];
  const clientOptions = clients.map((client) => ({
    value: client.id,
    label: `${client.fullName} - ${client.identityDocument}`,
  }));
  const productOptions = products.map((product) => ({
    value: product.id,
    label: `${product.description} - disponible ${product.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}`,
  }));
  const total = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  const paymentTotal = paymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const paymentDifference = Math.round((total - paymentTotal) * 100) / 100;

  const create = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast('Pedido registrado');
      setModalOpen(false);
    },
    onError: (err) => setError(getApiError(err, 'No se pudo registrar el pedido')),
  });

  const invoicedMutation = useMutation({
    mutationFn: ({ id, isInvoiced }: { id: string; isInvoiced: boolean }) => ordersApi.setInvoiced(id, isInvoiced),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast(variables.isInvoiced ? 'Pedido marcado como facturado' : 'Facturacion retirada');
    },
    onError: (err) => toast(getApiError(err, 'No se pudo cambiar la facturacion'), 'error'),
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => ordersApi.void(id, reason),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast(order.inventoryAppliedAt ? 'Pedido anulado e inventario devuelto' : 'Pedido histórico anulado sin movimiento de inventario');
      setVoiding(null);
      setVoidReason('');
    },
    onError: (err) => toast(getApiError(err, 'No se pudo anular el pedido'), 'error'),
  });

  const setFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setClientId('');
    setDeliveryAddress('');
    setClientPhone('');
    setPaymentLines([emptyPayment()]);
    setObservations('');
    setLines([emptyLine()]);
    setError('');
    setModalOpen(true);
  };

  const updateLine = (index: number, patch: Partial<OrderLineForm>) => {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  };

  const updatePaymentLine = (index: number, patch: Partial<PaymentLineForm>) => {
    setPaymentLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  };

  const addPaymentLine = () => {
    const used = new Set(paymentLines.map((line) => line.method));
    const method = (['CASH', 'BANK', 'CREDIT'] as OrderPaymentMethod[]).find((item) => !used.has(item));
    if (method) setPaymentLines((current) => [...current, { method, amount: '' }]);
  };

  async function openTicket(order: Order) {
    try {
      openBlob(await ordersApi.ticketPdf(order.id));
    } catch {
      toast('No se pudo abrir la tirilla del pedido', 'error');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!clientId) {
      setError('Selecciona un cliente');
      return;
    }
    if (lines.some((line) => !line.productId)) {
      setError('Selecciona un producto en cada linea');
      return;
    }
    const requestedQuantityByProduct = new Map<string, number>();
    lines.forEach((line) => {
      requestedQuantityByProduct.set(
        line.productId,
        (requestedQuantityByProduct.get(line.productId) || 0) + Number(line.quantity || 0),
      );
    });
    const insufficient = [...requestedQuantityByProduct].find(([productId, requestedQuantity]) => {
      const product = products.find((item) => item.id === productId);
      return !product || requestedQuantity > product.quantity;
    });
    if (insufficient) {
      const [productId, requestedQuantity] = insufficient;
      const product = products.find((item) => item.id === productId);
      setError(
        `Inventario insuficiente para ${product?.description || 'el producto seleccionado'}. `
        + `Disponible: ${product?.quantity.toLocaleString('es-CO', { maximumFractionDigits: 3 }) || 0}; `
        + `solicitado: ${requestedQuantity.toLocaleString('es-CO', { maximumFractionDigits: 3 })}.`,
      );
      return;
    }
    if (new Set(paymentLines.map((line) => line.method)).size !== paymentLines.length) {
      setError('No repitas la misma forma de pago');
      return;
    }
    if (paymentLines.some((line) => Number(line.amount) <= 0)) {
      setError('Ingresa un valor mayor a cero para cada forma de pago');
      return;
    }
    if (Math.abs(paymentDifference) > 0.009) {
      setError(paymentDifference > 0
        ? `Falta distribuir ${money(paymentDifference)} entre las formas de pago`
        : `La distribución excede el total por ${money(Math.abs(paymentDifference))}`);
      return;
    }
    await create.mutateAsync({
      clientId,
      deliveryAddress,
      clientPhone,
      observations,
      items: lines.map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      })),
      payments: paymentLines.map((line) => ({ method: line.method, amount: Number(line.amount) })),
    });
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pedidos</h1>
          <p className="text-sm text-mute">Cada pedido descuenta inmediatamente las existencias del punto de venta.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo</Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Desde"><Input type="date" value={filters.fromDate} onChange={(event) => setFilter('fromDate', event.target.value)} /></Field>
          <Field label="Hasta"><Input type="date" value={filters.toDate} onChange={(event) => setFilter('toDate', event.target.value)} /></Field>
          {isAdmin && (
            <Field label="Usuario">
              <Select value={filters.userId} onChange={(event) => setFilter('userId', event.target.value)}>
                <option value="">Todos</option>
                {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Estado"><Select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}><option value="">Todos</option><option value="ACTIVE">Activo</option><option value="VOID">Anulado</option></Select></Field>
          <Field label="Buscar">
            <div className="relative">
              <Input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Id, cliente o producto" className="pl-9" />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            </div>
          </Field>
        </div>
      </Card>

      {isLoading || !data ? (
        <Spinner />
      ) : data.data.length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-mute">
                <tr>
                  <th className="px-4 py-3">Id documento</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Productos</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.data.map((order) => (
                  <tr key={order.id} className={order.status === 'VOID' ? 'bg-expense-soft/25' : ''}>
                    <td className="px-4 py-3 font-mono font-semibold">{order.documentNumber}</td>
                    <td className="px-4 py-3">{dateInput(order.createdAt)}</td>
                    <td className="px-4 py-3"><p className="font-semibold">{order.clientName}</p><p className="text-xs text-mute">{order.clientDocument}</p></td>
                    <td className="px-4 py-3">
                      <ul className="space-y-1">
                        {order.items.slice(0, 2).map((item) => (
                          <li key={item.id}><span className="font-medium">{item.productDescription}</span> <span className="text-xs text-mute">x {item.quantity} a {money(item.unitPrice)}</span></li>
                        ))}
                        {order.items.length > 2 && <li className="text-xs font-semibold text-brand-dark">+ {order.items.length - 2} productos mas</li>}
                      </ul>
                    </td>
                    <td className="money px-4 py-3 font-bold text-brand-dark">{money(order.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1"><Badge tone={order.status === 'VOID' ? 'expense' : 'income'}>{order.status === 'VOID' ? 'Anulado' : 'Activo'}</Badge>{order.status === 'ACTIVE' && <span className="text-xs text-mute">{order.invoicedAt ? 'Facturado' : 'Pendiente de facturar'}</span>}</div>
                    </td>
                    <td className="px-4 py-3">{order.user?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" className="px-2 py-1.5" onClick={() => setViewingOrder(order)}>
                          <Eye className="h-4 w-4" /> Ver detalle
                        </Button>
                        <Button variant="secondary" className="px-2 py-1.5" onClick={() => openTicket(order)} title="Ver tirilla PDF">
                          <FileText className="h-4 w-4" /> Ver tirilla
                        </Button>
                        {isAdmin && order.status === 'ACTIVE' && (
                          <Button
                            variant={order.invoicedAt ? 'secondary' : 'primary'}
                            className="px-2 py-1.5"
                            disabled={invoicedMutation.isPending}
                            onClick={() => invoicedMutation.mutate({ id: order.id, isInvoiced: !order.invoicedAt })}
                          >
                            <ReceiptText className="h-4 w-4" /> {order.invoicedAt ? 'Desmarcar' : 'Facturar'}
                          </Button>
                        )}
                        {order.status === 'ACTIVE' && (isAdmin || order.userId === user?.id) && <Button variant="ghost" className="px-2 py-1.5 text-expense" onClick={() => { setVoiding(order); setVoidReason(''); }}><Ban className="h-4 w-4" /> Anular</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4"><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} /></div>
        </Card>
      ) : (
        <EmptyState title="Sin pedidos" action={<Button onClick={openCreate}>Registrar pedido</Button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo pedido">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Cliente" hint="Escribe el nombre o documento; deja el campo vacio para ver todos.">
            <SearchableSelect
              value={clientId}
              onChange={setClientId}
              options={clientOptions}
              placeholder="Buscar cliente por nombre o documento"
              emptyMessage="No se encontraron clientes"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Direccion de entrega">
              <Input
                required
                minLength={3}
                maxLength={300}
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                placeholder="Direccion completa del cliente"
              />
            </Field>
            <Field label="Telefono">
              <Input
                required
                type="tel"
                minLength={7}
                maxLength={50}
                value={clientPhone}
                onChange={(event) => setClientPhone(event.target.value)}
                placeholder="Numero de contacto"
              />
            </Field>
          </div>

          <Field label="Observaciones" hint="Opcional. Apareceran en la tirilla del pedido.">
            <textarea
              className="input min-h-24 resize-y"
              maxLength={1000}
              value={observations}
              onChange={(event) => setObservations(event.target.value)}
              placeholder="Indicaciones de entrega u otras notas"
            />
          </Field>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Productos</p>
                <p className="text-xs text-mute">Puedes repetir un producto para asignarle otro precio.</p>
              </div>
              <Button variant="secondary" className="px-3 py-1.5" onClick={() => setLines((current) => [...current, emptyLine()])}><Plus className="h-4 w-4" /> Agregar</Button>
            </div>
            {lines.map((line, index) => (
              <div key={index} className="rounded-lg border border-line p-3">
                <Field label={`Producto ${index + 1}`}>
                  <SearchableSelect
                    value={line.productId}
                    onChange={(productId) => updateLine(index, { productId })}
                    options={productOptions}
                    placeholder="Buscar producto"
                    emptyMessage="No se encontraron productos"
                  />
                </Field>
                <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Field label="Cantidad"><Input required type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} /></Field>
                  <Field label="Valor unitario"><Input required type="number" min="0.01" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} /></Field>
                  <div className="flex items-end"><Button variant="ghost" className="px-2 text-expense" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} title="Quitar producto"><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-brand-soft px-4 py-3">
            <span className="text-sm font-semibold text-brand-dark">Total pedido</span>
            <span className="money text-lg font-bold text-brand-dark">{money(total)}</span>
          </div>
          <div className="space-y-3 rounded-xl border border-line p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold">Formas de pago</p><p className="text-xs text-mute">Distribuye el total entre efectivo, banco y/o crédito.</p></div><Button variant="secondary" className="px-3 py-1.5" onClick={addPaymentLine} disabled={paymentLines.length >= 3}><Plus className="h-4 w-4" /> Agregar pago</Button></div>
            {paymentLines.map((payment, index) => {
              const otherPayments = paymentLines.reduce((sum, line, lineIndex) => sum + (lineIndex === index ? 0 : Number(line.amount || 0)), 0);
              const availableMethods = new Set(paymentLines.filter((_, lineIndex) => lineIndex !== index).map((line) => line.method));
              return <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Field label={`Forma ${index + 1}`}><Select value={payment.method} onChange={(event) => updatePaymentLine(index, { method: event.target.value as OrderPaymentMethod })}><option value="CASH" disabled={availableMethods.has('CASH')}>Efectivo</option><option value="BANK" disabled={availableMethods.has('BANK')}>Banco</option><option value="CREDIT" disabled={availableMethods.has('CREDIT')}>Crédito / cartera</option></Select></Field>
                <Field label="Valor" hint="Puedes asignar automáticamente el saldo pendiente."><div className="flex gap-2"><Input required type="number" min="0.01" step="0.01" value={payment.amount} onChange={(event) => updatePaymentLine(index, { amount: event.target.value })} /><Button variant="ghost" className="shrink-0 px-2" title="Usar valor restante" onClick={() => updatePaymentLine(index, { amount: Math.max(0, total - otherPayments).toFixed(2) })}>Restante</Button></div></Field>
                <div className="flex items-end"><Button variant="ghost" className="px-2 text-expense" disabled={paymentLines.length === 1} onClick={() => setPaymentLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>
              </div>;
            })}
            <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm"><span>Distribuido: <strong>{money(paymentTotal)}</strong></span><span className={Math.abs(paymentDifference) > 0.009 ? 'font-bold text-expense' : 'font-bold text-brand-dark'}>{paymentDifference > 0 ? `Pendiente: ${money(paymentDifference)}` : paymentDifference < 0 ? `Excede: ${money(Math.abs(paymentDifference))}` : 'Pago completo'}</span></div>
          </div>
          {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Guardando...' : 'Registrar pedido'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewingOrder)}
        onClose={() => setViewingOrder(null)}
        title={`Detalle del pedido${viewingOrder ? ` ${viewingOrder.documentNumber}` : ''}`}
        size="large"
      >
        {viewingOrder && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-paper p-3">
                <p className="text-xs font-semibold uppercase text-mute">Fecha</p>
                <p className="mt-1 font-semibold">{dateInput(viewingOrder.createdAt)}</p>
              </div>
              <div className="rounded-lg bg-paper p-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase text-mute">Cliente</p>
                <p className="mt-1 font-semibold">{viewingOrder.clientName}</p>
                <p className="text-xs text-mute">{viewingOrder.clientDocument}</p>
              </div>
              <div className="rounded-lg bg-paper p-3">
                <p className="text-xs font-semibold uppercase text-mute">Usuario</p>
                <p className="mt-1 font-semibold">{viewingOrder.user?.name || '-'}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-paper p-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase text-mute">Direccion de entrega</p>
                <p className="mt-1 font-semibold">{viewingOrder.deliveryAddress || 'No registrada'}</p>
              </div>
              <div className="rounded-lg bg-paper p-3">
                <p className="text-xs font-semibold uppercase text-mute">Telefono</p>
                <p className="mt-1 font-semibold">{viewingOrder.clientPhone || 'No registrado'}</p>
              </div>
              <div className="rounded-lg bg-paper p-3">
                <p className="text-xs font-semibold uppercase text-mute">Formas de pago</p>
                <div className="mt-1 space-y-1">{viewingOrder.payments?.length ? viewingOrder.payments.map((payment) => <p key={payment.id} className="flex justify-between gap-2 font-semibold"><span>{payment.method === 'CASH' ? 'Efectivo' : payment.method === 'BANK' ? 'Banco' : 'Crédito'}</span><span className="money">{money(payment.amount)}</span></p>) : <p>No registradas</p>}{viewingOrder.creditAmount > 0 && <p className="flex justify-between gap-2 border-t border-line pt-1 text-expense"><span>Saldo cartera</span><strong className="money">{money(viewingOrder.balanceDue)}</strong></p>}</div>
              </div>
              <div className="rounded-lg bg-paper p-3 sm:col-span-2 lg:col-span-4">
                <p className="text-xs font-semibold uppercase text-mute">Observaciones</p>
                <p className="mt-1 whitespace-pre-wrap">{viewingOrder.observations || 'Sin observaciones'}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-line">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-paper text-left text-xs uppercase text-mute">
                    <tr>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-right">Cantidad</th>
                      <th className="px-4 py-3 text-right">Valor unitario</th>
                      <th className="px-4 py-3 text-right">Valor total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {viewingOrder.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-semibold">{item.productDescription}</td>
                        <td className="px-4 py-3 text-right">{item.quantity}</td>
                        <td className="money px-4 py-3 text-right">{money(item.unitPrice)}</td>
                        <td className="money px-4 py-3 text-right font-semibold">{money(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-line bg-brand-soft px-4 py-3">
                <span className="text-sm font-bold text-brand-dark">Total ({viewingOrder.items.length} productos)</span>
                <span className="money text-lg font-extrabold text-brand-dark">{money(viewingOrder.totalAmount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Badge tone={viewingOrder.status === 'VOID' ? 'expense' : viewingOrder.invoicedAt ? 'income' : 'neutral'}>{viewingOrder.status === 'VOID' ? 'Anulado' : viewingOrder.invoicedAt ? 'Facturado' : 'Pendiente de facturacion'}</Badge>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => openTicket(viewingOrder)}><FileText className="h-4 w-4" /> Ver tirilla PDF</Button>
                <Button variant="secondary" onClick={() => setViewingOrder(null)}>Cerrar</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(voiding)} onClose={() => setVoiding(null)} title="Anular pedido">
        <div className="space-y-4">
          <p className="text-sm text-mute">{voiding?.inventoryAppliedAt ? <>Se devolverán automáticamente al inventario todos los productos del pedido <strong>{voiding.documentNumber}</strong>.</> : <>Este pedido es histórico y se anulará sin modificar el inventario.</>}</p>
          <Field label="Motivo" hint="Opcional"><Input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={191} /></Field>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setVoiding(null)}>Cancelar</Button><Button variant="danger" disabled={!voiding || voidMutation.isPending} onClick={() => voiding && voidMutation.mutate({ id: voiding.id, reason: voidReason })}>{voidMutation.isPending ? 'Anulando...' : 'Anular y devolver inventario'}</Button></div>
        </div>
      </Modal>
    </section>
  );
}
