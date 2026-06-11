import { BarChart3, CreditCard, FolderTree, HandCoins, History, LogOut, Repeat2, Settings, WalletCards } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

const nav = [
  { to: '/', label: 'Dashboard', icon: BarChart3 },
  { to: '/accounts', label: 'Cuentas', icon: WalletCards },
  { to: '/categories', label: 'Categorias', icon: FolderTree },
  { to: '/transactions', label: 'Movimientos', icon: CreditCard },
  { to: '/transfers', label: 'Transferencias', icon: Repeat2 },
  { to: '/loans', label: 'Prestamos', icon: HandCoins },
  { to: '/history', label: 'Historicos', icon: History },
  { to: '/profile', label: 'Perfil', icon: Settings },
];

export function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <div className="mb-8">
          <img src={`${import.meta.env.BASE_URL}brand/caudalia-horizontal.png`} alt="Caudalia" className="h-12 w-auto object-contain" />
        </div>
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${isActive ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-slate-200 pt-4">
          <div className="mb-3 rounded-md bg-slate-50 p-3">
            <p className="truncate text-sm font-bold text-ink">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
          <button onClick={logout} className="btn-soft w-full">
            <LogOut size={18} /> Salir
          </button>
        </div>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <img src={`${import.meta.env.BASE_URL}brand/caudalia-horizontal.png`} alt="Caudalia" className="h-9 w-auto object-contain" />
            <button onClick={logout} className="btn-soft px-2" title="Salir">
              <LogOut size={18} />
            </button>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} className="btn-soft shrink-0 px-2" title={item.label}>
                  <Icon size={17} />
                </NavLink>
              );
            })}
          </nav>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
