import { useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, PiggyBank, Wallet } from 'lucide-react';
import { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dashboardApi } from '../api/resources';
import { EmptyState } from '../ui/EmptyState';
import { StatCard } from '../ui/StatCard';
import { dateInput, money } from '../utils/format';

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardApi.get() });
  if (isLoading) return <p className="text-sm text-slate-500">Cargando dashboard...</p>;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-ink">Dashboard</h1>
        <p className="text-sm text-slate-500">Resumen de saldos, flujo de caja y ultimos movimientos.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Saldo total" value={money(data.summary.totalBalance)} icon={<Wallet />} />
        <StatCard label="Ingresos del mes" value={money(data.summary.income)} tone="good" icon={<ArrowUpCircle />} />
        <StatCard label="Gastos del mes" value={money(data.summary.expense)} tone="bad" icon={<ArrowDownCircle />} />
        <StatCard label="Flujo neto" value={money(data.summary.netFlow)} tone="warm" icon={<PiggyBank />} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Ingresos vs gastos">
          {data.charts.monthlyFlow.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.charts.monthlyFlow}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Bar dataKey="income" fill="#2aa876" name="Ingresos" />
                <Bar dataKey="expense" fill="#e86a58" name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState text="Aun no hay movimientos para graficar." />}
        </ChartPanel>
        <ChartPanel title="Gastos por categoria">
          {data.charts.expensesByCategory.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.charts.expensesByCategory} dataKey="value" nameKey="name" outerRadius={95} label>
                  {data.charts.expensesByCategory.map((entry: any) => <Cell key={entry.categoryId} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value) => money(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState text="Sin gastos en el rango actual." />}
        </ChartPanel>
        <ChartPanel title="Evolucion del saldo">
          {data.charts.balanceEvolution.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.charts.balanceEvolution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Line dataKey="balance" stroke="#16213a" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="Registra movimientos para ver evolucion." />}
        </ChartPanel>
        <ChartPanel title="Distribucion por cuenta">
          {data.charts.accountDistribution.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.charts.accountDistribution} margin={{ top: 12, right: 16, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => money(Number(value))} width={88} />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Bar dataKey="value" name="Saldo" fill="#0F9B62" radius={[8, 8, 0, 0]} minPointSize={3} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState text="Crea cuentas para ver distribucion." />}
        </ChartPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="panel">
          <h2 className="mb-3 font-black text-ink">Cuentas</h2>
          <div className="space-y-3">
            {data.accounts.map((account: any) => (
              <div key={account.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="font-semibold">{account.name}</span>
                <span>{money(account.currentBalance)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2 className="mb-3 font-black text-ink">Ultimos movimientos</h2>
          <div className="space-y-3">
            {data.recentMovements.map((item: any) => (
              <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm">
                <div>
                  <p className="font-semibold">{item.account}</p>
                  <p className="text-slate-500">{dateInput(item.date)} · {item.category}</p>
                </div>
                <span className={item.type === 'EXPENSE' ? 'font-bold text-coral' : 'font-bold text-mint'}>{money(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel">
      <h2 className="mb-3 font-black text-ink">{title}</h2>
      {children}
    </div>
  );
}
