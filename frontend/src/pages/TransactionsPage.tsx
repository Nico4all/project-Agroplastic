import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { accountsApi, categoriesApi, transactionsApi } from '../api/resources';
import { TransactionType } from '../types';
import { AccountBalanceCard } from '../ui/AccountBalanceCard';
import { dateInput, money } from '../utils/format';

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const { data: transactions } = useQuery({ queryKey: ['transactions'], queryFn: () => transactionsApi.list({ pageSize: 20 }) });
  const create = useMutation({ mutationFn: transactionsApi.create, onSuccess: () => queryClient.invalidateQueries() });
  const remove = useMutation({ mutationFn: transactionsApi.remove, onSuccess: () => queryClient.invalidateQueries() });
  const [form, setForm] = useState({ accountId: '', categoryId: '', type: 'EXPENSE' as TransactionType, amount: 0, transactionDate: dateInput(), description: '' });
  const filteredCategories = categories.filter((category) => category.type === form.type && category.isActive);
  const activeAccounts = accounts.filter((account) => account.isActive);
  const selectedAccount = accounts.find((account) => account.id === form.accountId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync(form);
    setForm({ ...form, amount: 0, description: '' });
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-ink">Movimientos</h1>
        <p className="text-sm text-slate-500">Ingresos y gastos afectan el saldo de la cuenta seleccionada.</p>
      </div>
      <form onSubmit={submit} className="panel grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TransactionType, categoryId: '' })}>
          <option value="EXPENSE">Gasto</option>
          <option value="INCOME">Ingreso</option>
        </select>
        <select className="input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} required>
          <option value="">Cuenta</option>
          {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
        <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
          <option value="">Categoria</option>
          {filteredCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
        <input className="input" type="date" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} required />
        <button className="btn-primary"><Plus size={18} /> Crear</button>
        <div className="md:col-span-3 xl:col-span-6">
          <AccountBalanceCard account={selectedAccount} />
        </div>
        <input className="input md:col-span-3 xl:col-span-6" placeholder="Descripcion" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </form>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-slate-500">
            <tr><th className="py-2">Fecha</th><th>Tipo</th><th>Cuenta</th><th>Categoria</th><th>Descripcion</th><th className="text-right">Monto</th><th /></tr>
          </thead>
          <tbody>
            {(transactions?.data || []).map((row: any) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="py-3">{dateInput(row.transactionDate)}</td>
                <td>{row.type === 'INCOME' ? 'Ingreso' : 'Gasto'}</td>
                <td>{row.account?.name}</td>
                <td>{row.category?.name}</td>
                <td>{row.description}</td>
                <td className={`text-right font-bold ${row.type === 'INCOME' ? 'text-mint' : 'text-coral'}`}>{money(row.amount)}</td>
                <td className="text-right"><button className="btn-soft px-2" onClick={() => remove.mutate(row.id)} title="Eliminar"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
