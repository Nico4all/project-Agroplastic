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
import { UsersPage } from './pages/UsersPage';

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
      { path: 'products', element: <ProductsPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'users', element: <UsersPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
], {
  basename: import.meta.env.BASE_URL.replace(/\/$/, ''),
});
