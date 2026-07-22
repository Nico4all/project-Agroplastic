import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, FileText, Plus, ReceiptText, Search, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { clientsApi, ordersApi, productsApi, usersApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { Order } from '../types';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Pagination, SearchableSelect, Select, Spinner, useToast } from '../ui/components';
import { openBlob } from '../utils/download';
import { dateInput, money } from '../utils/format';

type OrderLineForm = { productId: string; quantity: string; unitPrice: string };
const emptyLine = (): OrderLineForm => ({ productId: '', quantity: '1', unitPrice: '' });

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

export function OrdersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', userId: '', search: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [lines, setLines] = useState<OrderLineForm[]>([emptyLine()]);
  const [error, setError] = useState('');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  const params = useMemo(
    () => Object.fromEntries(Object.entries({ page, pageSize: 15, ...filters }).filter(([, value]) => value !== '')),
    [page, filters],
  );
  const { data, isLoading } = useQuery({ queryKey: ['orders', params], queryFn: () => ordersApi.list(params) });
  const { data: clientsData } = useQuery({ queryKey: ['clients', 'order-form'], queryFn: () => clientsApi.list({ pageSize: 2000, isActive: true }) });
  const { data: products = [] } = useQuery({ queryKey: ['products', 'order-form'], queryFn: () => productsApi.list({ isActive: true }) });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: isAdmin });
  const clients = clientsData?.data || [];
  const clientOptions = clients.map((client) => ({
    value: client.id,
    label: `${client.fullName} - ${client.identityDocument}`,
  }));
  const productOptions = products.map((product) => ({ value: product.id, label: product.description }));
  const total = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);

  const create = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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

  const setFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setClientId('');
    setLines([emptyLine()]);
    setError('');
    setModalOpen(true);
  };

  const updateLine = (index: number, patch: Partial<OrderLineForm>) => {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
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
    await create.mutateAsync({
      clientId,
      items: lines.map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      })),
    });
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pedidos</h1>
          <p className="text-sm text-mute">Pedidos informativos sin movimientos de inventario.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo</Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                  <th className="px-4 py-3">Facturacion</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.data.map((order) => (
                  <tr key={order.id}>
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
                      <Badge tone={order.invoicedAt ? 'income' : 'neutral'}>{order.invoicedAt ? 'Facturado' : 'Pendiente'}</Badge>
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
                        {isAdmin && (
                          <Button
                            variant={order.invoicedAt ? 'secondary' : 'primary'}
                            className="px-2 py-1.5"
                            disabled={invoicedMutation.isPending}
                            onClick={() => invoicedMutation.mutate({ id: order.id, isInvoiced: !order.invoicedAt })}
                          >
                            <ReceiptText className="h-4 w-4" /> {order.invoicedAt ? 'Desmarcar' : 'Facturar'}
                          </Button>
                        )}
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Productos</p>
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
                  <Field label="Precio"><Input required type="number" min="0.01" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} /></Field>
                  <div className="flex items-end"><Button variant="ghost" className="px-2 text-expense" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} title="Quitar producto"><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-brand-soft px-4 py-3">
            <span className="text-sm font-semibold text-brand-dark">Total pedido</span>
            <span className="money text-lg font-bold text-brand-dark">{money(total)}</span>
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

            <div className="overflow-hidden rounded-xl border border-line">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-paper text-left text-xs uppercase text-mute">
                    <tr>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-right">Cantidad</th>
                      <th className="px-4 py-3 text-right">Precio unitario</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
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
              <Badge tone={viewingOrder.invoicedAt ? 'income' : 'neutral'}>{viewingOrder.invoicedAt ? 'Facturado' : 'Pendiente de facturacion'}</Badge>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => openTicket(viewingOrder)}><FileText className="h-4 w-4" /> Ver tirilla PDF</Button>
                <Button variant="secondary" onClick={() => setViewingOrder(null)}>Cerrar</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
