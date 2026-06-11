import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { accountsApi, transfersApi } from '../api/resources';
import { AccountBalanceCard } from '../ui/AccountBalanceCard';
import { useToast } from '../ui/components';
import { dateInput, money } from '../utils/format';

export function TransfersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list });
  const { data: transfers } = useQuery({ queryKey: ['transfers'], queryFn: () => transfersApi.list({ pageSize: 20 }) });
  const create = useMutation({
    mutationFn: transfersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast('Transferencia creada');
    },
    onError: () => toast('No se pudo crear la transferencia', 'error'),
  });
  const remove = useMutation({
    mutationFn: transfersApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast('Transferencia eliminada');
    },
    onError: () => toast('No se pudo eliminar la transferencia', 'error'),
  });
  const activeAccounts = accounts.filter((account) => account.isActive);
  const [form, setForm] = useState({ fromAccountId: '', toAccountId: '', amount: 0, transferDate: dateInput(), description: '' });
  const fromAccount = accounts.find((account) => account.id === form.fromAccountId);
  const toAccount = accounts.find((account) => account.id === form.toAccountId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync(form);
    setForm({ ...form, amount: 0, description: '' });
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-ink">Transferencias</h1>
        <p className="text-sm text-slate-500">Mover saldo entre cuentas sin contarlo como ingreso o gasto real.</p>
      </div>
      <form onSubmit={submit} className="panel grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <select className="input" value={form.fromAccountId} onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })} required>
          <option value="">Origen</option>
          {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
        <select className="input" value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })} required>
          <option value="">Destino</option>
          {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
        <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
        <input className="input" type="date" value={form.transferDate} onChange={(e) => setForm({ ...form, transferDate: e.target.value })} required />
        <button className="btn-primary"><Plus size={18} /> Crear</button>
        <div className="grid gap-3 md:col-span-3 md:grid-cols-2 xl:col-span-5">
          <AccountBalanceCard account={fromAccount} label="Saldo cuenta origen" emptyText="Selecciona origen" />
          <AccountBalanceCard account={toAccount} label="Saldo cuenta destino" emptyText="Selecciona destino" />
        </div>
        <input className="input md:col-span-3 xl:col-span-5" placeholder="Descripcion" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </form>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-left text-slate-500">
            <tr><th className="py-2">Fecha</th><th>Origen</th><th>Destino</th><th>Descripcion</th><th className="text-right">Monto</th><th /></tr>
          </thead>
          <tbody>
            {(transfers?.data || []).map((row: any) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="py-3">{dateInput(row.transferDate)}</td>
                <td>{row.fromAccount?.name}</td>
                <td>{row.toAccount?.name}</td>
                <td>{row.description}</td>
                <td className="text-right font-bold">{money(row.amount)}</td>
                <td className="text-right"><button className="btn-soft px-2" onClick={() => remove.mutate(row.id)} title="Eliminar"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
