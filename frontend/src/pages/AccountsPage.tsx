import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { accountsApi } from '../api/resources';
import { Account, AccountType } from '../types';
import { Toggle, useToast } from '../ui/components';
import { money } from '../utils/format';

const accountTypes: { value: AccountType; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'BANK', label: 'Banco' },
  { value: 'SAVINGS', label: 'Ahorro' },
  { value: 'CREDIT_CARD', label: 'Tarjeta' },
  { value: 'DIGITAL_WALLET', label: 'Billetera digital' },
  { value: 'OTHER', label: 'Otro' },
];

export function AccountsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list });
  const create = useMutation({
    mutationFn: accountsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast('Cuenta creada');
    },
    onError: () => toast('No se pudo guardar la cuenta', 'error'),
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Account> }) => accountsApi.update(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      if ('isActive' in variables.payload) toast(variables.payload.isActive ? 'Cuenta activada' : 'Cuenta inactivada');
      else toast('Cuenta actualizada');
    },
    onError: () => toast('No se pudo actualizar la cuenta', 'error'),
  });
  const [form, setForm] = useState({ name: '', type: 'CASH' as AccountType, initialBalance: 0 });
  const [editing, setEditing] = useState<Record<string, { name: string; type: AccountType }>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync(form);
    setForm({ name: '', type: 'CASH', initialBalance: 0 });
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-ink">Cuentas</h1>
        <p className="text-sm text-slate-500">Activos financieros separados por usuario.</p>
      </div>
      <form onSubmit={submit} className="panel grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
        <input className="input" placeholder="Nombre de cuenta" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}>
          {accountTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <input className="input" type="number" min="0" step="0.01" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: Number(e.target.value) })} />
        <button className="btn-primary"><Plus size={18} /> Crear</button>
      </form>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.map((account) => (
          <article key={account.id} className="panel">
            {editing[account.id] ? (
              <div className="space-y-3">
                <input className="input" value={editing[account.id].name} onChange={(e) => setEditing({ ...editing, [account.id]: { ...editing[account.id], name: e.target.value } })} />
                <select className="input" value={editing[account.id].type} onChange={(e) => setEditing({ ...editing, [account.id]: { ...editing[account.id], type: e.target.value as AccountType } })}>
                  {accountTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => {
                    update.mutate({ id: account.id, payload: editing[account.id] });
                    const next = { ...editing };
                    delete next[account.id];
                    setEditing(next);
                  }}><Check size={17} /> Guardar</button>
                  <button className="btn-soft" onClick={() => {
                    const next = { ...editing };
                    delete next[account.id];
                    setEditing(next);
                  }}><X size={17} /> Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-ink">{account.name}</p>
                  <p className="text-sm text-slate-500">{accountTypes.find((item) => item.value === account.type)?.label}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold ${account.isActive ? 'bg-mint/10 text-mint' : 'bg-slate-100 text-slate-500'}`}>
                    {account.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <button className="btn-soft px-2" title="Editar" onClick={() => setEditing({ ...editing, [account.id]: { name: account.name, type: account.type } })}>
                  <Pencil size={17} />
                </button>
              </div>
            )}
            <p className="mt-4 text-2xl font-black">{money(account.currentBalance)}</p>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-paper px-3 py-2">
              <span className="text-sm font-semibold text-mute">{account.isActive ? 'Cuenta activa' : 'Cuenta inactiva'}</span>
              <Toggle checked={account.isActive} label="Activar o inactivar cuenta" onChange={(value) => update.mutate({ id: account.id, payload: { isActive: value } })} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
