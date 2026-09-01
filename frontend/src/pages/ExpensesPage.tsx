import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Download, FileText, Plus, Search } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { expenseCategoriesApi, expensesApi, usersApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { CashExpense, RecordStatus } from '../types';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Pagination, Select, Spinner, useToast } from '../ui/components';
import { downloadBlob, openBlob } from '../utils/download';
import { dateInput, money } from '../utils/format';
import { isAdminRole } from '../utils/roles';

const statusLabels: Record<RecordStatus, string> = {
  ACTIVE: 'Activo',
  VOID: 'Anulado',
};

type ExpenseForm = {
  categoryId: string;
  paidTo: string;
  amount: string;
  appliesRetention: boolean;
  retentionPercentage: string;
  expenseDate: string;
  approvedBy: string;
  description: string;
};

const emptyForm: ExpenseForm = {
  categoryId: '',
  paidTo: '',
  amount: '',
  appliesRetention: false,
  retentionPercentage: '',
  expenseDate: dateInput(),
  approvedBy: '',
  description: '',
};

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return message || fallback;
}

export function ExpensesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = isAdminRole(user?.role);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', userId: '', categoryId: '', status: '', search: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ExpenseForm>({ ...emptyForm, approvedBy: user?.name || '' });
  const [voiding, setVoiding] = useState<CashExpense | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [formError, setFormError] = useState('');

  const params = useMemo(
    () => Object.fromEntries(Object.entries({ page, pageSize: 15, ...filters }).filter(([, value]) => value !== '' && value !== undefined)),
    [page, filters],
  );

  const { data, isLoading } = useQuery({ queryKey: ['expenses', params], queryFn: () => expensesApi.list(params) });
  const { data: categories = [] } = useQuery({ queryKey: ['expense-categories'], queryFn: expenseCategoriesApi.list });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: isAdmin });
  const activeCategories = categories.filter((category) => category.isActive);
  const calculatedRetentionAmount = useMemo(() => {
    if (!form.appliesRetention || !form.amount || !form.retentionPercentage) return '';
    const amount = Number(form.amount);
    const percentage = Number(form.retentionPercentage);
    if (!Number.isFinite(amount) || !Number.isFinite(percentage)) return '';
    return Math.round((amount * percentage / 100 + Number.EPSILON) * 100) / 100;
  }, [form.amount, form.appliesRetention, form.retentionPercentage]);

  const create = useMutation({
    mutationFn: expensesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('Egreso registrado');
      setModalOpen(false);
    },
    onError: (err) => setFormError(getApiError(err, 'No se pudo registrar el egreso')),
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => expensesApi.void(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('Egreso anulado');
      setVoiding(null);
      setVoidReason('');
    },
    onError: () => toast('No se pudo anular el egreso', 'error'),
  });

  const causedMutation = useMutation({
    mutationFn: ({ id, isCaused }: { id: string; isCaused: boolean }) => expensesApi.setCaused(id, isCaused),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast(variables.isCaused ? 'Egreso marcado como causado' : 'Causacion retirada');
    },
    onError: (err) => toast(getApiError(err, 'No se pudo cambiar la causacion'), 'error'),
  });

  const setFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setForm({ ...emptyForm, expenseDate: dateInput(), approvedBy: user?.name || '' });
    setFormError('');
    setModalOpen(true);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    await create.mutateAsync({
      categoryId: form.categoryId,
      paidTo: form.paidTo,
      amount: Number(form.amount),
      appliesRetention: form.appliesRetention,
      retentionPercentage: form.appliesRetention ? Number(form.retentionPercentage) : undefined,
      expenseDate: form.expenseDate,
      approvedBy: form.approvedBy,
      description: form.description,
    });
  }

  async function exportFile(kind: 'excel' | 'pdf') {
    try {
      const blob = kind === 'excel' ? await expensesApi.exportExcel(params) : await expensesApi.exportPdf(params);
      downloadBlob(blob, kind === 'excel' ? 'egresos.xls' : 'egresos.pdf');
    } catch {
      toast('No se pudo exportar el listado', 'error');
    }
  }

  async function openReceipt(id: string) {
    try {
      openBlob(await expensesApi.receiptPdf(id));
    } catch {
      toast('No se pudo abrir el PDF', 'error');
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Egresos</h1>
          <p className="text-sm text-mute">Gastos de caja menor por categoria y bodega.</p>
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
          <Field label="Categoria">
            <Select value={filters.categoryId} onChange={(event) => setFilter('categoryId', event.target.value)}>
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
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
              <Input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Id, pagado a o descripcion" className="pl-9" />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            </div>
          </Field>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-mute">Total activo</p>
          <p className="money mt-2 text-2xl font-bold text-expense">{money(data?.summary?.active || 0)}</p>
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
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-mute">
                <tr>
                  <th className="px-4 py-3">Id documento</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Pagado a</th>
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
                    <td className="px-4 py-3">{dateInput(item.expenseDate)}</td>
                    <td className="px-4 py-3">{item.category?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{item.paidTo}</p>
                      {item.description && <p className="truncate text-xs text-mute">{item.description}</p>}
                    </td>
                    <td className={`money px-4 py-3 font-bold ${item.status === 'VOID' ? 'text-mute line-through' : 'text-expense'}`}>{money(item.amount)}</td>
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
        <EmptyState title="Sin egresos" action={<Button onClick={openCreate}>Registrar egreso</Button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo egreso">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Categoria">
            <Select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
              <option value="">Selecciona categoria</option>
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Pagado a">
            <Input required minLength={2} maxLength={120} value={form.paidTo} onChange={(event) => setForm({ ...form, paidTo: event.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valor">
              <Input required type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </Field>
            <Field label="Fecha">
              <Input required type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} />
            </Field>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-paper px-4 py-3">
            <input
              type="checkbox"
              checked={form.appliesRetention}
              onChange={(event) =>
                setForm({
                  ...form,
                  appliesRetention: event.target.checked,
                  ...(!event.target.checked ? { retentionPercentage: '' } : {}),
                })
              }
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>
              <span className="block text-sm font-semibold">Aplica retencion / descuento</span>
              <span className="mt-0.5 block text-xs text-mute">El valor aplicado se calcula automaticamente sobre el valor del egreso.</span>
            </span>
          </label>
          {form.appliesRetention && (
            <div className="grid gap-3 rounded-lg border border-brand/20 bg-brand-soft/40 p-3 sm:grid-cols-2">
              <Field label="Porcentaje (%)">
                <Input
                  required
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={form.retentionPercentage}
                  onChange={(event) => setForm({ ...form, retentionPercentage: event.target.value })}
                  placeholder="Ej. 4"
                />
              </Field>
              <Field label="Valor aplicado">
                <Input
                  type="number"
                  step="0.01"
                  value={calculatedRetentionAmount}
                  disabled
                  placeholder="Se calcula automaticamente"
                />
              </Field>
            </div>
          )}
          <Field label="Aprobado por">
            <Input maxLength={120} value={form.approvedBy} onChange={(event) => setForm({ ...form, approvedBy: event.target.value })} />
          </Field>
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

      <Modal open={Boolean(voiding)} onClose={() => setVoiding(null)} title="Anular egreso">
        <div className="space-y-4">
          <p className="text-sm text-mute">El egreso quedara marcado como anulado y seguira visible en el listado.</p>
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
