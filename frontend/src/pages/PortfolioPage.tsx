import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, HandCoins, ReceiptText, Search } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { pointsOfSaleApi, portfolioApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { PaymentMethod, PortfolioOrder } from '../types';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, useToast } from '../ui/components';
import { dateInput, money } from '../utils/format';
import { isAdminRole } from '../utils/roles';

const today = () => new Date().toLocaleDateString('en-CA');

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

export function PortfolioPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = isAdminRole(user?.role);
  const [pointOfSaleId, setPointOfSaleId] = useState('');
  const [search, setSearch] = useState('');
  const [collecting, setCollecting] = useState<PortfolioOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState('');
  const [collectionDate, setCollectionDate] = useState(today());
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const params = useMemo(() => Object.fromEntries(Object.entries({ pointOfSaleId, search }).filter(([, value]) => value)), [pointOfSaleId, search]);
  const { data, isLoading } = useQuery({ queryKey: ['portfolio', params], queryFn: () => portfolioApi.list(params) });
  const { data: points = [] } = useQuery({ queryKey: ['points-of-sale'], queryFn: pointsOfSaleApi.list, enabled: isAdmin });

  const collect = useMutation({
    mutationFn: portfolioApi.collect,
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast(`Recaudo ${result.documentNumber} registrado`);
      setCollecting(null);
    },
    onError: (err) => setError(getApiError(err, 'No se pudo registrar el recaudo')),
  });

  const openCollection = (order: PortfolioOrder) => {
    setCollecting(order);
    setPaymentMethod('CASH');
    setAmount(order.balanceDue.toFixed(2));
    setCollectionDate(today());
    setDescription('');
    setError('');
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!collecting) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError('Ingresa un valor válido');
    if (numericAmount > collecting.balanceDue) return setError('El recaudo no puede superar el saldo pendiente');
    await collect.mutateAsync({
      orderId: collecting.id,
      paymentMethod: paymentMethod as 'CASH' | 'BANK',
      amount: numericAmount,
      collectionDate,
      description,
    });
  }

  return (
    <section className="space-y-6">
      <div><h1 className="text-2xl font-extrabold tracking-tight">Cartera</h1><p className="text-sm text-mute">Clientes con crédito, pedidos pendientes y recaudos de cartera.</p></div>

      <Card className="p-4"><div className={`grid gap-3 ${isAdmin ? 'md:grid-cols-2' : ''}`}>
        {isAdmin && <Field label="Punto de venta"><Select value={pointOfSaleId} onChange={(event) => setPointOfSaleId(event.target.value)}><option value="">Todos</option>{points.filter((point) => point.isActive).map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}</Select></Field>}
        <Field label="Buscar"><div className="relative"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, documento o pedido" className="pl-9" /><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" /></div></Field>
      </div></Card>

      {isLoading || !data ? <Spinner /> : <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4"><p className="text-xs font-semibold uppercase text-mute">Saldo de cartera</p><p className="money mt-2 text-2xl font-bold text-expense">{money(data.summary.balanceDue)}</p></Card>
          <Card className="p-4"><p className="text-xs font-semibold uppercase text-mute">Clientes con saldo</p><p className="mt-2 text-2xl font-bold text-brand-dark">{data.summary.clients}</p></Card>
          <Card className="p-4"><p className="text-xs font-semibold uppercase text-mute">Pedidos pendientes</p><p className="mt-2 text-2xl font-bold text-brand-dark">{data.summary.orders}</p></Card>
          <Card className="p-4"><p className="text-xs font-semibold uppercase text-mute">Recaudado</p><p className="money mt-2 text-2xl font-bold text-brand-dark">{money(data.summary.collectedAmount)}</p></Card>
        </div>

        {data.clients.length ? <div className="space-y-4">{data.clients.map((client) => <Card key={client.clientId} className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3"><div><p className="font-bold">{client.clientName}</p><p className="text-xs text-mute">{client.clientDocument}</p></div><div className="text-right"><p className="text-xs font-semibold uppercase text-mute">Saldo pendiente</p><p className="money text-lg font-extrabold text-expense">{money(client.balanceDue)}</p></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead className="text-left text-xs uppercase text-mute"><tr><th className="px-4 py-3">Pedido / factura</th><th className="px-4 py-3">Punto de venta</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3 text-right">Crédito</th><th className="px-4 py-3 text-right">Recaudado</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3 text-right">Acción</th></tr></thead><tbody className="divide-y divide-line">{client.orders.map((order) => <tr key={order.id}><td className="px-4 py-3"><p className="font-mono font-semibold">{order.documentNumber}</p><Badge tone={order.invoicedAt ? 'income' : 'neutral'}>{order.invoicedAt ? 'Facturado' : 'Pedido sin facturar'}</Badge>{order.collections.length > 0 && <p className="mt-1 text-xs text-mute">Último recaudo: {order.collections[order.collections.length - 1]?.documentNumber}</p>}</td><td className="px-4 py-3">{order.pointOfSale?.name || '-'}</td><td className="px-4 py-3">{dateInput(order.createdAt)}</td><td className="money px-4 py-3 text-right">{money(order.creditAmount)}</td><td className="money px-4 py-3 text-right text-brand-dark">{money(order.collectedAmount)}</td><td className="money px-4 py-3 text-right font-bold text-expense">{money(order.balanceDue)}</td><td className="px-4 py-3 text-right"><Button onClick={() => openCollection(order)}><HandCoins className="h-4 w-4" /> Recaudar</Button></td></tr>)}</tbody></table></div>
        </Card>)}</div> : <EmptyState title="No hay cartera pendiente" />}
      </>}

      <Modal open={Boolean(collecting)} onClose={() => setCollecting(null)} title="Registrar recaudo de cartera">
        {collecting && <form onSubmit={submit} className="space-y-4">
          <div className="rounded-lg bg-brand-soft p-3 text-sm"><p><strong>{collecting.clientName}</strong> · {collecting.documentNumber}</p><p>Saldo pendiente: <strong className="money">{money(collecting.balanceDue)}</strong></p></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Medio de recaudo"><Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}><option value="CASH">Efectivo</option><option value="BANK">Banco</option></Select></Field><Field label="Fecha"><Input required type="date" value={collectionDate} onChange={(event) => setCollectionDate(event.target.value)} /></Field></div>
          <Field label="Valor"><div className="relative"><Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" /><Input required className="pl-9" type="number" min="0.01" max={collecting.balanceDue} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div></Field>
          <Field label="Descripción" hint="Opcional"><Input maxLength={191} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={`Recaudo pedido ${collecting.documentNumber}`} /></Field>
          {error && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCollecting(null)}>Cancelar</Button><Button type="submit" disabled={collect.isPending}><ReceiptText className="h-4 w-4" /> {collect.isPending ? 'Guardando...' : 'Registrar recaudo'}</Button></div>
        </form>}
      </Modal>
    </section>
  );
}
