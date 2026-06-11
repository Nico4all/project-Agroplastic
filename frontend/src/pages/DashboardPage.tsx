import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Scale, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { accountsApi, categoriesApi, dashboardApi } from '../api/resources';
import { Card, EmptyState, Field, Input, Select, Spinner } from '../ui/components';
import { dateInput, money } from '../utils/format';

const fallbackColors = [
  '#0F9B62',
  '#5667CE',
  '#DD4A48',
  '#C8A24B',
  '#06b6d4',
  '#a855f7',
  '#f59e0b',
  '#ec4899',
  '#64748b',
  '#3b82f6',
];

const accountTypeLabels: Record<string, string> = {
  CASH: 'Efectivo',
  BANK: 'Banco',
  SAVINGS: 'Cuenta de ahorro',
  CREDIT_CARD: 'Tarjeta',
  DIGITAL_WALLET: 'Billetera digital',
  OTHER: 'Otro',
};

function tooltipMoney(value?: number | string | readonly (number | string)[]) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return money(Number(rawValue || 0));
}

function monthLabel(value: string) {
  if (!value) return '';
  const [year, month] = value.split('-');
  const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const index = Number(month) - 1;
  return `${labels[index] || month} ${year?.slice(2) || ''}`;
}

export function DashboardPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const params = useMemo(
    () => Object.fromEntries(Object.entries({ fromDate, toDate, accountId, categoryId }).filter(([, value]) => value !== '')),
    [fromDate, toDate, accountId, categoryId],
  );

  const { data, isLoading } = useQuery({ queryKey: ['dashboard', params], queryFn: () => dashboardApi.get(params) });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });

  const monthlyFlow = (data?.charts?.monthlyFlow || []).map((item: any) => ({
    ...item,
    label: monthLabel(item.month),
  }));
  const expensesByCategory = (data?.charts?.expensesByCategory || []).map((item: any, index: number) => ({
    ...item,
    color: item.color || fallbackColors[index % fallbackColors.length],
  }));
  const accountDistribution = data?.charts?.accountDistribution || [];
  const totalAbsAccounts = accountDistribution.reduce((sum: number, account: any) => sum + Math.abs(Number(account.value || 0)), 0);

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
    setAccountId('');
    setCategoryId('');
  };

  if (isLoading || !data) return <Spinner />;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-mute">
            {fromDate || toDate ? `Periodo: ${fromDate || 'inicio'} - ${toDate || 'hoy'}` : 'Resumen del mes actual y evolucion financiera.'}
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Desde">
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </Field>
          <Field label="Cuenta">
            <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Todas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoria">
            <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <button className="btn-soft w-full" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="guilloche relative overflow-hidden rounded-2xl bg-ink p-6 text-white lg:col-span-1">
          <div className="absolute inset-x-0 top-0 h-1 bg-gold" />
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Saldo total</p>
          <p className="money mt-3 text-3xl font-bold">{money(data.summary.totalBalance)}</p>
          <p className="mt-2 text-xs text-white/50">Suma de las cuentas activas</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-brand-dark">
              <ArrowUpRight className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Ingresos</span>
            </div>
            <p className="money mt-3 text-xl font-bold text-brand-dark">{money(data.summary.income)}</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-expense">
              <ArrowDownLeft className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Gastos</span>
            </div>
            <p className="money mt-3 text-xl font-bold text-expense">{money(data.summary.expense)}</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-mute">
              <Scale className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Flujo neto</span>
            </div>
            <p className={`money mt-3 text-xl font-bold ${data.summary.netFlow >= 0 ? 'text-brand-dark' : 'text-expense'}`}>
              {money(data.summary.netFlow)}
            </p>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold">Ingresos vs gastos por mes</h2>
          {monthlyFlow.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyFlow}>
                  <CartesianGrid stroke="#E4E9E4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#5C6B62" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#5C6B62" width={88} tickFormatter={(value) => money(Number(value))} />
                  <Tooltip formatter={tooltipMoney} />
                  <Legend />
                  <Bar dataKey="income" name="Ingresos" fill="#0F9B62" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Gastos" fill="#DD4A48" radius={[4, 4, 0, 0]} />
                  <Line dataKey="net" name="Neto" stroke="#16251E" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Sin movimientos para graficar" />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold">Evolucion del saldo</h2>
          {data.charts.balanceEvolution.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.charts.balanceEvolution}>
                  <defs>
                    <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0F9B62" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#0F9B62" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E4E9E4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#5C6B62" tickFormatter={(value) => dateInput(value).slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} stroke="#5C6B62" width={88} tickFormatter={(value) => money(Number(value))} />
                  <Tooltip formatter={tooltipMoney} />
                  <Area dataKey="balance" name="Saldo" stroke="#0F9B62" strokeWidth={2} fill="url(#balanceFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Registra movimientos para ver evolucion" />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold">Gastos por categoria</h2>
          {expensesByCategory.length ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-56 w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expensesByCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {expensesByCategory.map((entry: any) => (
                        <Cell key={entry.categoryId} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={tooltipMoney} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-2 sm:w-1/2">
                {expensesByCategory.slice(0, 6).map((category: any) => (
                  <li key={category.categoryId} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="flex-1 truncate">{category.name}</span>
                    <span className="money font-semibold">{money(category.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState title="Sin gastos en el periodo" />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold">Flujo neto mensual</h2>
          {monthlyFlow.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyFlow}>
                  <CartesianGrid stroke="#E4E9E4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#5C6B62" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#5C6B62" width={88} tickFormatter={(value) => money(Number(value))} />
                  <Tooltip formatter={tooltipMoney} />
                  <Bar dataKey="net" name="Neto" radius={[4, 4, 0, 0]} minPointSize={3}>
                    {monthlyFlow.map((month: any) => (
                      <Cell key={month.month} fill={month.net >= 0 ? '#0F9B62' : '#DD4A48'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Sin flujo mensual" />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold">Distribucion por cuenta</h2>
          {accountDistribution.length ? (
            <ul className="space-y-3">
              {accountDistribution.map((account: any) => {
                const value = Number(account.value || 0);
                const pct = totalAbsAccounts > 0 ? Math.min((Math.abs(value) / totalAbsAccounts) * 100, 100) : 0;
                return (
                  <li key={account.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate font-medium">{account.name}</span>
                      <span className={`money ${value >= 0 ? 'text-mute' : 'text-expense'}`}>{money(value)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-paper">
                      <div className={`h-full rounded-full ${value >= 0 ? 'bg-brand' : 'bg-expense'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Sin cuentas activas" />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold">Tus cuentas</h2>
          {data.accounts.length ? (
            <ul className="space-y-3">
              {data.accounts.map((account: any) => (
                <li key={account.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{account.name}</p>
                    <p className="text-xs text-mute">{accountTypeLabels[account.type] || account.type}</p>
                  </div>
                  <span className="money text-sm font-bold">{money(account.currentBalance)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Aun no tienes cuentas" subtitle="Crea tu primera cuenta para registrar movimientos." />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold">Ultimos movimientos</h2>
          {data.recentMovements.length ? (
            <ul className="space-y-2.5">
              {data.recentMovements.map((item: any) => (
                <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      item.type === 'INCOME'
                        ? 'bg-brand-soft text-brand-dark'
                        : item.type === 'EXPENSE'
                          ? 'bg-expense-soft text-expense'
                          : 'bg-transfer-soft text-transfer'
                    }`}
                  >
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.description || item.category || 'Movimiento'}</p>
                    <p className="text-xs text-mute">
                      {dateInput(item.date)} - {item.account}
                    </p>
                  </div>
                  <span
                    className={`money text-sm font-bold ${
                      item.type === 'INCOME' ? 'text-brand-dark' : item.type === 'EXPENSE' ? 'text-expense' : 'text-transfer'
                    }`}
                  >
                    {item.type === 'EXPENSE' ? '-' : item.type === 'INCOME' ? '+' : ''}
                    {money(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sin movimientos todavia" />
          )}
        </Card>
      </div>
    </section>
  );
}
