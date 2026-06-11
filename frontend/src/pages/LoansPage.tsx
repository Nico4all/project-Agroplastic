import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { accountsApi, loansApi } from '../api/resources';
import { Loan, LoanType } from '../types';
import { AccountBalanceCard } from '../ui/AccountBalanceCard';
import { dateInput, money } from '../utils/format';

export function LoansPage() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<LoanType>('RECEIVABLE');
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list });
  const { data } = useQuery({ queryKey: ['loans', type], queryFn: () => loansApi.list({ type }) });
  const createLoan = useMutation({ mutationFn: loansApi.create, onSuccess: () => queryClient.invalidateQueries() });
  const removeLoan = useMutation({ mutationFn: loansApi.remove, onSuccess: () => queryClient.invalidateQueries() });
  const createPayment = useMutation({
    mutationFn: ({ loanId, payload }: { loanId: string; payload: any }) => loansApi.createPayment(loanId, payload),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const removePayment = useMutation({
    mutationFn: ({ loanId, paymentId }: { loanId: string; paymentId: string }) => loansApi.removePayment(loanId, paymentId),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const activeAccounts = accounts.filter((account) => account.isActive);
  const [form, setForm] = useState({
    accountId: '',
    personName: '',
    principalAmount: 0,
    loanDate: dateInput(),
    description: '',
  });
  const [payments, setPayments] = useState<Record<string, { accountId: string; amount: number; paymentDate: string; description: string }>>({});
  const selectedLoanAccount = accounts.find((account) => account.id === form.accountId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await createLoan.mutateAsync({ ...form, type });
    setForm({ accountId: '', personName: '', principalAmount: 0, loanDate: dateInput(), description: '' });
  }

  async function pay(event: FormEvent, loan: Loan) {
    event.preventDefault();
    const payload = payments[loan.id] || { accountId: loan.accountId, amount: 0, paymentDate: dateInput(), description: '' };
    await createPayment.mutateAsync({ loanId: loan.id, payload });
    setPayments({ ...payments, [loan.id]: { accountId: loan.accountId, amount: 0, paymentDate: dateInput(), description: '' } });
  }

  const title = type === 'RECEIVABLE' ? 'Cuentas por cobrar' : 'Cuentas por pagar';
  const help = type === 'RECEIVABLE'
    ? 'Dinero que prestaste. Baja tu saldo al crear el prestamo y sube cuando te pagan.'
    : 'Dinero que te prestaron. Sube tu saldo al crear el prestamo y baja cuando pagas.';

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-ink">Prestamos</h1>
          <p className="text-sm text-slate-500">Cuentas por cobrar y por pagar con abonos parciales.</p>
        </div>
        <div className="inline-flex rounded-md bg-slate-100 p-1">
          <button className={`btn px-3 ${type === 'RECEIVABLE' ? 'bg-white shadow-soft' : 'text-slate-600'}`} onClick={() => setType('RECEIVABLE')}>Por cobrar</button>
          <button className={`btn px-3 ${type === 'PAYABLE' ? 'bg-white shadow-soft' : 'text-slate-600'}`} onClick={() => setType('PAYABLE')}>Por pagar</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="panel">
          <p className="text-sm text-slate-500">Pendiente por cobrar</p>
          <p className="mt-1 text-2xl font-black text-mint">{money(data?.summary?.receivableOpen || 0)}</p>
        </div>
        <div className="panel">
          <p className="text-sm text-slate-500">Pendiente por pagar</p>
          <p className="mt-1 text-2xl font-black text-coral">{money(data?.summary?.payableOpen || 0)}</p>
        </div>
      </div>

      <form onSubmit={submit} className="panel grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="md:col-span-3 xl:col-span-6">
          <p className="font-black text-ink">{title}</p>
          <p className="text-sm text-slate-500">{help}</p>
        </div>
        <input className="input" placeholder="Persona" value={form.personName} onChange={(e) => setForm({ ...form, personName: e.target.value })} required />
        <select className="input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} required>
          <option value="">Cuenta destino</option>
          {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
        <input className="input" type="number" min="0.01" step="0.01" value={form.principalAmount} onChange={(e) => setForm({ ...form, principalAmount: Number(e.target.value) })} required />
        <input className="input" type="date" value={form.loanDate} onChange={(e) => setForm({ ...form, loanDate: e.target.value })} required />
        <input className="input xl:col-span-2" placeholder="Descripcion" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="md:col-span-3 xl:col-span-6">
          <AccountBalanceCard account={selectedLoanAccount} label="Saldo cuenta del prestamo" />
        </div>
        <button className="btn-primary md:col-span-3 xl:col-span-6"><Plus size={18} /> Crear prestamo</button>
      </form>

      <div className="grid gap-4">
        {(data?.data || []).map((loan: Loan) => {
          const payment = payments[loan.id] || { accountId: loan.accountId, amount: loan.remainingAmount, paymentDate: dateInput(), description: '' };
          const paymentAccount = accounts.find((account) => account.id === payment.accountId);
          return (
            <article key={loan.id} className="panel">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-black text-ink">{loan.personName}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${loan.status === 'PAID' ? 'bg-mint/10 text-mint' : 'bg-amber/20 text-amber'}`}>
                      {loan.status === 'PAID' ? 'Pagado' : 'Abierto'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{dateInput(loan.loanDate)} · {loan.account?.name} · {loan.description}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-right text-sm">
                  <div><p className="text-slate-500">Inicial</p><p className="font-black">{money(loan.principalAmount)}</p></div>
                  <div><p className="text-slate-500">Abonado</p><p className="font-black text-mint">{money(loan.paidAmount)}</p></div>
                  <div><p className="text-slate-500">Pendiente</p><p className="font-black text-coral">{money(loan.remainingAmount)}</p></div>
                </div>
              </div>

              {loan.status === 'OPEN' && (
                <form onSubmit={(event) => pay(event, loan)} className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_160px_1fr_auto]">
                  <select className="input" value={payment.accountId} onChange={(e) => setPayments({ ...payments, [loan.id]: { ...payment, accountId: e.target.value } })} required>
                    {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                  <input className="input" type="number" min="0.01" max={loan.remainingAmount} step="0.01" value={payment.amount} onChange={(e) => setPayments({ ...payments, [loan.id]: { ...payment, amount: Number(e.target.value) } })} required />
                  <input className="input" type="date" value={payment.paymentDate} onChange={(e) => setPayments({ ...payments, [loan.id]: { ...payment, paymentDate: e.target.value } })} required />
                  <input className="input" placeholder={type === 'RECEIVABLE' ? 'Me pagaron...' : 'Pague...'} value={payment.description} onChange={(e) => setPayments({ ...payments, [loan.id]: { ...payment, description: e.target.value } })} />
                  <button className="btn-primary"><CheckCircle2 size={18} /> Abonar</button>
                  <div className="md:col-span-5">
                    <AccountBalanceCard account={paymentAccount} label="Saldo cuenta del abono" />
                  </div>
                </form>
              )}

              <div className="mt-4 space-y-2">
                {loan.payments?.map((paymentItem) => (
                  <div key={paymentItem.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <span>{dateInput(paymentItem.paymentDate)} · {paymentItem.description || 'Abono'} · {paymentItem.account?.name}</span>
                    <span className="flex items-center gap-3 font-bold">
                      {money(paymentItem.amount)}
                      <button className="btn-soft px-2" title="Eliminar abono" onClick={() => removePayment.mutate({ loanId: loan.id, paymentId: paymentItem.id })}>
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>

              {!loan.payments?.length && (
                <button className="btn-danger mt-4" onClick={() => removeLoan.mutate(loan.id)}>
                  <Trash2 size={16} /> Eliminar prestamo
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
