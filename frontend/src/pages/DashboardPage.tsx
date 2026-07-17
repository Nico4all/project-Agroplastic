import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dashboardApi, usersApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { Card, EmptyState, Field, Input, Select, Spinner } from '../ui/components';
import { dateInput, money } from '../utils/format';

function labelIncomeType(value: string) {
  return value === 'ADVANCE' ? 'Anticipo' : 'Pago cartera';
}

function tooltipMoney(value?: number | string | readonly (number | string)[]) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return money(Number(rawValue || 0));
}

export function DashboardPage() {
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [userId, setUserId] = useState('');
  const [city, setCity] = useState('');
  const isAdmin = user?.role === 'ADMIN';

  const params = useMemo(
    () => Object.fromEntries(Object.entries({ fromDate, toDate, userId, city }).filter(([, value]) => value !== '')),
    [fromDate, toDate, userId, city],
  );

  const { data, isLoading } = useQuery({ queryKey: ['dashboard', params], queryFn: () => dashboardApi.get(params) });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: isAdmin });
  const cities = Array.from(new Set(users.map((item) => item.city).filter(Boolean))) as string[];
  const expensesByUser = data?.expensesByUser || [];

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
    setUserId('');
    setCity('');
  };

  if (isLoading || !data) return <Spinner />;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Panel</h1>
          <p className="text-sm text-mute">Resumen de caja, anticipos, cartera y gastos por bodega.</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Desde">
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </Field>
          {isAdmin && (
            <>
              <Field label="Usuario">
                <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
                  <option value="">Todos</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ciudad">
                <Select value={city} onChange={(event) => setCity(event.target.value)}>
                  <option value="">Todas</option>
                  {cities.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          <div className="flex items-end">
            <button className="btn-soft w-full" onClick={clearFilters}>
              Limpiar
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-brand-dark">
            <ArrowUpRight className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Ingresos</span>
          </div>
          <p className="money mt-3 text-2xl font-bold text-brand-dark">{money(data.summary.income)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-expense">
            <ArrowDownLeft className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Gastos</span>
          </div>
          <p className="money mt-3 text-2xl font-bold text-expense">{money(data.summary.expense)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-mute">
            <Scale className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Neto</span>
          </div>
          <p className={`money mt-3 text-2xl font-bold ${data.summary.net >= 0 ? 'text-brand-dark' : 'text-expense'}`}>
            {money(data.summary.net)}
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-bold">Gasto por usuario</h2>
        {expensesByUser.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expensesByUser}>
                <CartesianGrid stroke="#E4E9E4" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#5C6B62" />
                <YAxis tick={{ fontSize: 11 }} stroke="#5C6B62" width={88} tickFormatter={(value) => money(Number(value))} />
                <Tooltip formatter={tooltipMoney} />
                <Bar dataKey="value" name="Gasto" fill="#DD4A48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="Sin gastos en el periodo" />
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold">Ultimos gastos por usuario</h2>
          {data.recentExpensesByUser.length ? (
            <div className="space-y-5">
              {data.recentExpensesByUser.map((group: any) => (
                <div key={group.user.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold">{group.user.name}</p>
                    <span className="text-xs text-mute">{group.user.city || group.user.username}</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {group.items.map((item: any) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.paidTo}</p>
                          <p className="text-xs text-mute">{dateInput(item.date)} - {item.category}</p>
                        </div>
                        <span className={`money font-bold ${item.status === 'VOID' ? 'text-mute line-through' : 'text-expense'}`}>
                          {money(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin egresos recientes" />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold">Ultimos ingresos por usuario</h2>
          {data.recentIncomesByUser.length ? (
            <div className="space-y-5">
              {data.recentIncomesByUser.map((group: any) => (
                <div key={group.user.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold">{group.user.name}</p>
                    <span className="text-xs text-mute">{group.user.city || group.user.username}</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {group.items.map((item: any) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.clientName}</p>
                          <p className="text-xs text-mute">{dateInput(item.date)} - {labelIncomeType(item.type)}</p>
                        </div>
                        <span className={`money font-bold ${item.status === 'VOID' ? 'text-mute line-through' : 'text-brand-dark'}`}>
                          {money(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin ingresos recientes" />
          )}
        </Card>
      </div>
    </section>
  );
}
