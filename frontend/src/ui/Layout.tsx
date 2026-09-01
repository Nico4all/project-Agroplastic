import {
  BarChart3,
  Building2,
  FolderTree,
  HandCoins,
  LogOut,
  Menu,
  Package,
  PackagePlus,
  Tags,
  ReceiptText,
  ShoppingCart,
  Store,
  Users,
  UserSquare2,
  X,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { isAdminRole } from '../utils/roles';

function Brand() {
  return (
    <div className="flex w-[210px] items-center justify-center rounded-lg bg-white px-3 py-2 shadow-card">
      <img
        src={`${import.meta.env.BASE_URL}brand/agroplastic-logo.png`}
        alt="AgroPlastick"
        className="h-10 w-full object-contain"
      />
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const dashboardNav = useMemo(() => [
    { to: '/', label: 'Panel', icon: BarChart3, end: true },
  ], []);
  const expensesNav = useMemo(() => [
    { to: '/expenses', label: 'Egresos', icon: ReceiptText },
    { to: '/categories', label: 'Categorias', icon: FolderTree },
  ], []);
  const ordersNav = useMemo(() => [
    { to: '/incomes', label: 'Ingresos', icon: HandCoins },
    { to: '/orders', label: 'Pedidos', icon: ShoppingCart },
    { to: '/inventory', label: 'Inventario', icon: PackagePlus },
    { to: '/clients', label: 'Clientes', icon: UserSquare2 },
    { to: '/products', label: 'Productos pedidos', icon: Package },
  ], []);
  const catalogNav = useMemo(() => [
    { to: '/price-list', label: 'Productos', icon: Tags },
    { to: '/suppliers', label: 'Proveedores', icon: Building2 },
  ], []);
  const adminNav = useMemo(() => isAdminRole(user?.role) ? [
      { to: '/points-of-sale', label: 'Puntos de venta', icon: Store },
      { to: '/users', label: 'Usuarios', icon: Users },
    ] : [], [user?.role]);

  const renderLinks = (items: Array<{ to: string; label: string; icon: typeof BarChart3; end?: boolean }>) => items.map(({ to, label, icon: Icon, end }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          isActive ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      {label}
    </NavLink>
  ));

  return (
    <nav className="mt-8 flex flex-1 flex-col gap-1">
      {renderLinks(dashboardNav)}
      <p className="mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Egresos</p>
      {renderLinks(expensesNav)}
      <p className="mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Pedidos e inventario</p>
      {renderLinks(ordersNav)}
      <p className="mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Lista de precios</p>
      {renderLinks(catalogNav)}
      {adminNav.length > 0 && <p className="mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Administracion</p>}
      {renderLinks(adminNav)}
    </nav>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.name?.slice(0, 2).toUpperCase() || 'AP';
  const sidebarFooter = (
    <div className="border-t border-white/10 pt-3">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-bold uppercase text-gold">
          {initials}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
          <p className="truncate text-[11px] text-white/50">
            {user?.role === 'SUPERADMIN' ? 'Superadministrador' : user?.role === 'ADMIN' ? 'Administrador' : user?.pointOfSale?.name || 'Sin punto de venta'}
          </p>
        </div>
      </div>
      <button onClick={handleLogout} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white/65 transition hover:bg-white/10 hover:text-white">
        <LogOut className="h-4 w-4" /> Salir
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink px-4 py-6 lg:flex">
        <Brand />
        <NavItems />
        {sidebarFooter}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
        <Brand />
        <button onClick={() => setDrawerOpen(true)} aria-label="Abrir menu" className="rounded-lg p-2 text-white/80 hover:bg-white/10">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-ink/50 lg:hidden" onMouseDown={(event) => event.target === event.currentTarget && setDrawerOpen(false)}>
          <div className="flex h-full w-72 flex-col bg-ink px-4 py-6">
            <div className="flex items-center justify-between">
              <Brand />
              <button onClick={() => setDrawerOpen(false)} aria-label="Cerrar menu" className="rounded-lg p-2 text-white/70 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavItems onNavigate={() => setDrawerOpen(false)} />
            {sidebarFooter}
          </div>
        </div>
      )}

      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
