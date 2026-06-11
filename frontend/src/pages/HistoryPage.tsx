import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { useState } from 'react';
import { accountsApi, categoriesApi, historyApi } from '../api/resources';
import { dateInput, money } from '../utils/format';

type HistoryType =
  | ''
  | 'INCOME'
  | 'EXPENSE'
  | 'TRANSFER'
  | 'LOAN_RECEIVABLE'
  | 'LOAN_PAYABLE'
  | 'LOAN_PAYMENT_RECEIVED'
  | 'LOAN_PAYMENT_PAID';

export function HistoryPage() {
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    accountId: '',
    categoryId: '',
    type: '' as HistoryType,
    search: '',
    minAmount: '',
    maxAmount: '',
    page: 1,
    pageSize: 20,
    sort: 'desc',
  });
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const { data } = useQuery({ queryKey: ['history', params], queryFn: () => historyApi.list(params) });

  async function exportCsv() {
    const blob = await historyApi.exportCsv(params);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'historicos.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / filters.pageSize));

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-ink">Historicos</h1>
          <p className="text-sm text-slate-500">Consulta, resume y exporta movimientos por filtros.</p>
        </div>
        <button className="btn-primary" onClick={exportCsv}><Download size={18} /> CSV</button>
      </div>
      <div className="panel grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <input className="input" type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value, page: 1 })} />
        <input className="input" type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value, page: 1 })} />
        <select className="input" value={filters.accountId} onChange={(e) => setFilters({ ...filters, accountId: e.target.value, page: 1 })}>
          <option value="">Todas las cuentas</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
        <select className="input" value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value, page: 1 })}>
          <option value="">Todas las categorias</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select className="input" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value as HistoryType, page: 1 })}>
          <option value="">Todos</option>
          <option value="INCOME">Ingresos</option>
          <option value="EXPENSE">Gastos</option>
          <option value="TRANSFER">Transferencias</option>
          <option value="LOAN_RECEIVABLE">Prestamos entregados</option>
          <option value="LOAN_PAYABLE">Prestamos recibidos</option>
          <option value="LOAN_PAYMENT_RECEIVED">Pagos recibidos de prestamos</option>
          <option value="LOAN_PAYMENT_PAID">Pagos realizados de prestamos</option>
        </select>
        <input className="input" placeholder="Descripcion" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} />
        <input className="input" type="number" placeholder="Monto min" value={filters.minAmount} onChange={(e) => setFilters({ ...filters, minAmount: e.target.value, page: 1 })} />
        <input className="input" type="number" placeholder="Monto max" value={filters.maxAmount} onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value, page: 1 })} />
        <select className="input" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
          <option value="desc">Mas reciente</option>
          <option value="asc">Mas antiguo</option>
        </select>
        <button className="btn-soft"><Search size={18} /> Filtrar</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="panel"><p className="text-sm text-slate-500">Ingresos filtrados</p><p className="text-2xl font-black text-mint">{money(data?.summary?.income || 0)}</p></div>
        <div className="panel"><p className="text-sm text-slate-500">Gastos filtrados</p><p className="text-2xl font-black text-coral">{money(data?.summary?.expense || 0)}</p></div>
        <div className="panel"><p className="text-sm text-slate-500">Pagos recibidos de prestamos</p><p className="text-2xl font-black text-mint">{money(data?.summary?.loanPaymentsIn || 0)}</p></div>
        <div className="panel"><p className="text-sm text-slate-500">Pagos realizados de prestamos</p><p className="text-2xl font-black text-coral">{money(data?.summary?.loanPaymentsOut || 0)}</p></div>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-slate-500">
            <tr><th className="py-2">Fecha</th><th>Tipo</th><th>Cuenta</th><th>Categoria</th><th>Descripcion</th><th className="text-right">Monto</th></tr>
          </thead>
          <tbody>
            {(data?.data || []).map((row: any) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="py-3">{dateInput(row.date || row.transactionDate)}</td>
                <td>{row.typeLabel || labelForType(row.type)}</td>
                <td>{row.account?.name}</td>
                <td>{row.category?.name}</td>
                <td>{row.description}</td>
                <td className={`text-right font-bold ${amountClass(row)}`}>{money(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button className="btn-soft" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Anterior</button>
          <span className="text-sm text-slate-500">Pagina {filters.page} de {totalPages}</span>
          <button className="btn-soft" disabled={filters.page >= totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Siguiente</button>
        </div>
      </div>
    </section>
  );
}

function amountClass(row: any) {
  if (row.direction === 'IN') return 'text-mint';
  if (row.direction === 'OUT') return 'text-coral';
  return 'text-slate-700';
}

function labelForType(type: string) {
  const labels: Record<string, string> = {
    INCOME: 'Ingreso',
    EXPENSE: 'Gasto',
    TRANSFER: 'Transferencia',
    LOAN_RECEIVABLE: 'Prestamo entregado',
    LOAN_PAYABLE: 'Prestamo recibido',
    LOAN_PAYMENT_RECEIVED: 'Pago recibido de prestamo',
    LOAN_PAYMENT_PAID: 'Pago realizado de prestamo',
  };
  return labels[type] || type;
}
