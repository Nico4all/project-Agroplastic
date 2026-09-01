import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './ui/Layout';
import { ProtectedRoute } from './ui/ProtectedRoute';
import { CategoriesPage } from './pages/CategoriesPage';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { AuthPage } from './pages/AuthPage';
import { IncomesPage } from './pages/IncomesPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductsPage } from './pages/ProductsPage';
import { PointsOfSalePage } from './pages/PointsOfSalePage';
import { UsersPage } from './pages/UsersPage';
import { PriceListProductsPage } from './pages/PriceListProductsPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { InventoryPage } from './pages/InventoryPage';
import { PortfolioPage } from './pages/PortfolioPage';

export const router = createBrowserRouter([
  { path: '/login', element: <AuthPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'incomes', element: <IncomesPage /> },
      { path: 'expenses', element: <ExpensesPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'portfolio', element: <PortfolioPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'price-list', element: <PriceListProductsPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'points-of-sale', element: <PointsOfSalePage /> },
      { path: 'users', element: <UsersPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
], {
  basename: import.meta.env.BASE_URL.replace(/\/$/, ''),
});
