import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Download, FileText, Plus, Search } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { clientsApi, incomesApi, usersApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { CashIncome, IncomeType, PaymentMethod, RecordStatus } from '../types';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Pagination, SearchableSelect, Select, Spinner, useToast } from '../ui/components';
import { dateInput, money } from '../utils/format';
import { downloadBlob, openBlob } from '../utils/download';
import { isAdminRole } from '../utils/roles';

const incomeTypeLabels: Record<IncomeType, string> = {
  ADVANCE: 'Anticipo',
  RECEIVABLE_PAYMENT: 'Pago a cartera/factura',
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  BANK: 'Banco',
};

const statusLabels: Record<RecordStatus, string> = {
  ACTIVE: 'Activo',
  VOID: 'Anulado',
};

type IncomeForm = {
  clientId: string;
  type: IncomeType;
  paymentMethod: PaymentMethod;
  amount: string;
  incomeDate: string;
  description: string;
};

const emptyForm: IncomeForm = {
  clientId: '',
  type: 'RECEIVABLE_PAYMENT',
  paymentMethod: 'CASH',
  amount: '',
  incomeDate: dateInput(),
  description: '',
};

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

export function IncomesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = isAdminRole(user?.role);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', userId: '', type: '', paymentMethod: '', status: '', search: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<IncomeForm>(emptyForm);
  const [voiding, setVoiding] = useState<CashIncome | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [formError, setFormError] = useState('');

  const params = useMemo(
    () => Object.fromEntries(Object.entries({ page, pageSize: 15, ...filters }).filter(([, value]) => value !== '' && value !== undefined)),
    [page, filters],
  );

  const { data, isLoading } = useQuery({ queryKey: ['incomes', params], queryFn: () => incomesApi.list(params) });
  const { data: clientsData } = useQuery({ queryKey: ['clients', 'income-form'], queryFn: () => clientsApi.list({ pageSize: 2000, isActive: true }) });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: isAdmin });
  const clients = clientsData?.data || [];
  const clientOptions = clients.map((client) => ({
    value: client.id,
    label: `${client.fullName} - ${client.identityDocument}`,
  }));

  const create = useMutation({
    mutationFn: incomesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('Ingreso registrado');
      setModalOpen(false);
    },
    onError: (err) => setFormError(getApiError(err, 'No se pudo registrar el ingreso')),
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => incomesApi.void(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('Ingreso anulado');
      setVoiding(null);
      setVoidReason('');
    },
    onError: () => toast('No se pudo anular el ingreso', 'error'),
  });

  const causedMutation = useMutation({
    mutationFn: ({ id, isCaused }: { id: string; isCaused: boolean }) => incomesApi.setCaused(id, isCaused),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      toast(variables.isCaused ? 'Ingreso marcado como causado' : 'Causacion retirada');
    },
    onError: (err) => toast(getApiError(err, 'No se pudo cambiar la causacion'), 'error'),
  });

  const setFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setForm({ ...emptyForm, incomeDate: dateInput() });
    setFormError('');
    setModalOpen(true);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    if (!form.clientId) {
      setFormError('Selecciona un cliente');
      return;
    }
    await create.mutateAsync({
      clientId: form.clientId,
      type: form.type,
      paymentMethod: form.paymentMethod,
      amount: Number(form.amount),
      incomeDate: form.incomeDate,
      description: form.description,
    });
  }

  async function exportFile(kind: 'excel' | 'pdf') {
    try {
      const blob = kind === 'excel' ? await incomesApi.exportExcel(params) : await incomesApi.exportPdf(params);
      downloadBlob(blob, kind === 'excel' ? 'ingresos.xls' : 'ingresos.pdf');
    } catch {
      toast('No se pudo exportar el listado', 'error');
    }
  }

  async function openReceipt(id: string) {
    try {
      openBlob(await incomesApi.receiptPdf(id));
    } catch {
      toast('No se pudo abrir el PDF', 'error');
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Ingresos</h1>
          <p className="text-sm text-mute">Anticipos y pagos de cartera/factura por cliente.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => exportFile('excel')}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button variant="secondary" onClick={() => exportFile('pdf')}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Desde">
            <Input type="date" value={filters.fromDate} onChange={(event) => setFilter('fromDate', event.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={filters.toDate} onChange={(event) => setFilter('toDate', event.target.value)} />
          </Field>
          <Field label="Tipo">
            <Select value={filters.type} onChange={(event) => setFilter('type', event.target.value)}>
              <option value="">Todos</option>
              <option value="ADVANCE">Anticipo</option>
              <option value="RECEIVABLE_PAYMENT">Pago a cartera/factura</option>
            </Select>
          </Field>
          <Field label="Ingreso">
            <Select value={filters.paymentMethod} onChange={(event) => setFilter('paymentMethod', event.target.value)}>
              <option value="">Todos</option>
              <option value="CASH">Efectivo</option>
              <option value="BANK">Banco</option>
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
              <option value="">Todos</option>
              <option value="ACTIVE">Activo</option>
              <option value="VOID">Anulado</option>
            </Select>
          </Field>
          {isAdmin && (
            <>
              <Field label="Usuario">
                <Select value={filters.userId} onChange={(event) => setFilter('userId', event.target.value)}>
                  <option value="">Todos</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          <Field label="Buscar">
            <div className="relative">
              <Input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Id, cliente, documento o descripcion" className="pl-9" />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            </div>
          </Field>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-mute">Total activo</p>
          <p className="money mt-2 text-2xl font-bold text-brand-dark">{money(data?.summary?.active || 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-mute">Anulado</p>
          <p className="money mt-2 text-2xl font-bold text-mute">{money(data?.summary?.void || 0)}</p>
        </Card>
      </div>

      {isLoading || !data ? (
        <Spinner />
      ) : data.data.length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-mute">
                <tr>
                  <th className="px-4 py-3">Id documento</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Ingreso</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Causacion</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.data.map((item) => (
                  <tr key={item.id} className={item.status === 'VOID' ? 'bg-expense-soft/25' : ''}>
                    <td className="px-4 py-3 font-mono font-semibold">{item.documentNumber}</td>
                    <td className="px-4 py-3">{dateInput(item.incomeDate)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{item.clientName}</p>
                      <p className="text-xs text-mute">{item.clientDocument}</p>
                    </td>
                    <td className="px-4 py-3">{incomeTypeLabels[item.type]}</td>
                    <td className="px-4 py-3">{paymentMethodLabels[item.paymentMethod]}</td>
                    <td className={`money px-4 py-3 font-bold ${item.status === 'VOID' ? 'text-mute line-through' : 'text-brand-dark'}`}>{money(item.amount)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={item.status === 'ACTIVE' ? 'income' : 'expense'}>{statusLabels[item.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={item.causedAt ? 'income' : 'neutral'}>{item.causedAt ? 'Causado' : 'Pendiente'}</Badge>
                    </td>
                    <td className="px-4 py-3">{item.user?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {isAdmin && item.status === 'ACTIVE' && (
                          <Button
                            variant={item.causedAt ? 'secondary' : 'primary'}
                            className="px-2 py-1.5"
                            disabled={causedMutation.isPending}
                            onClick={() => causedMutation.mutate({ id: item.id, isCaused: !item.causedAt })}
                          >
                            <CheckCircle2 className="h-4 w-4" /> {item.causedAt ? 'Desmarcar' : 'Causar'}
                          </Button>
                        )}
                        <Button variant="ghost" className="px-2" title="Ver PDF" onClick={() => openReceipt(item.id)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        {item.status === 'ACTIVE' && (isAdmin || item.userId === user?.id) && (
                          <Button variant="ghost" className="px-2 text-expense" title="Anular" onClick={() => setVoiding(item)}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4">
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </div>
        </Card>
      ) : (
        <EmptyState title="Sin ingresos" action={<Button onClick={openCreate}>Registrar ingreso</Button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo ingreso">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Cliente" hint="Escribe el nombre o documento; deja el campo vacio para ver todos.">
            <SearchableSelect
              value={form.clientId}
              onChange={(clientId) => setForm({ ...form, clientId })}
              options={clientOptions}
              placeholder="Buscar cliente por nombre o documento"
              emptyMessage="No se encontraron clientes"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as IncomeType })}>
                <option value="ADVANCE">Anticipo</option>
                <option value="RECEIVABLE_PAYMENT">Pago a cartera/factura</option>
              </Select>
            </Field>
            <Field label="Ingreso">
              <Select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}>
                <option value="CASH">Efectivo</option>
                <option value="BANK">Banco</option>
              </Select>
            </Field>
            <Field label="Valor">
              <Input required type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </Field>
            <Field label="Fecha">
              <Input required type="date" value={form.incomeDate} onChange={(event) => setForm({ ...form, incomeDate: event.target.value })} />
            </Field>
          </div>
          <Field label="Descripcion">
            <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          {formError && <p className="rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Guardando...' : 'Registrar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(voiding)} onClose={() => setVoiding(null)} title="Anular ingreso">
        <div className="space-y-4">
          <p className="text-sm text-mute">El ingreso quedara marcado como anulado y seguira visible en el listado.</p>
          <Field label="Motivo">
            <Input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Opcional" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setVoiding(null)}>Cancelar</Button>
            <Button variant="danger" disabled={voidMutation.isPending || !voiding} onClick={() => voiding && voidMutation.mutate({ id: voiding.id, reason: voidReason })}>
              {voidMutation.isPending ? 'Anulando...' : 'Anular'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
