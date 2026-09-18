import {
  BarChart3,
  Bell,
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
  WalletCards,
  X,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { priceListApi } from '../api/resources';
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

function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['price-list-notifications', user?.id],
    queryFn: priceListApi.notifications,
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['price-list-notifications'] });
  const markRead = useMutation({ mutationFn: priceListApi.markNotificationRead, onSuccess: refresh });
  const markAllRead = useMutation({ mutationFn: priceListApi.markAllNotificationsRead, onSuccess: refresh });
  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const openNotification = (id: string, isUnread: boolean) => {
    if (isUnread) markRead.mutate(id);
    setOpen(false);
    navigate('/price-list');
  };

  return (
    <div className="fixed right-16 top-3 z-50 lg:right-8 lg:top-6">
      <button
        type="button"
        aria-label={unreadCount ? `${unreadCount} notificaciones sin leer` : 'Notificaciones'}
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-ink text-white shadow-card transition hover:bg-ink/90 lg:border-line lg:bg-surface lg:text-ink"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-expense px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div><p className="font-bold text-ink">Notificaciones</p><p className="text-xs text-mute">Cambios en listas de precios</p></div>
            {unreadCount > 0 && <button type="button" className="text-xs font-semibold text-brand hover:text-brand-dark" onClick={() => markAllRead.mutate()}>Marcar todas</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length ? notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification.id, !notification.readAt)}
                className={`block w-full border-b border-line px-4 py-3 text-left transition last:border-0 hover:bg-paper ${notification.readAt ? '' : 'bg-brand-soft/60'}`}
              >
                <div className="flex items-start gap-2">
                  {!notification.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  <div className="min-w-0"><p className="text-sm font-bold text-ink">{notification.title}</p><p className="mt-1 text-sm text-mute">{notification.message}</p><p className="mt-1.5 text-[11px] text-mute">{new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.createdAt))}</p></div>
                </div>
              </button>
            )) : <p className="px-4 py-8 text-center text-sm text-mute">No tienes notificaciones.</p>}
          </div>
        </div>
      )}
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
    { to: '/portfolio', label: 'Cartera', icon: WalletCards },
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
    <nav className="sidebar-scroll mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pb-4 pr-1">
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setDrawerOpen(false);
      navigate('/login', { replace: true });
    }
  };

  const initials = user?.name?.slice(0, 2).toUpperCase() || 'AP';
  const sidebarFooter = (
    <div className="shrink-0 border-t border-white/10 pt-3">
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
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" /> {isLoggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper">
      <NotificationBell />
      <aside className="fixed inset-y-0 left-0 z-30 hidden min-h-0 w-64 flex-col overflow-hidden bg-ink px-4 py-6 lg:flex">
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
          <div className="flex h-full min-h-0 w-72 flex-col overflow-hidden bg-ink px-4 py-6">
            <div className="flex shrink-0 items-center justify-between">
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

      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:py-8 lg:pl-10 lg:pr-24">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
