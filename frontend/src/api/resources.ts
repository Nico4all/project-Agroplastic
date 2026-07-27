import {
  Account,
  CashExpense,
  CashIncome,
  Category,
  Client,
  ExpenseCategory,
  Loan,
  LoanPayment,
  PaginatedResult,
  Order,
  Product,
  Transaction,
  Transfer,
  User,
} from '../types';
import { api } from './client';

export const profileApi = {
  update: async (payload: { name: string; email: string }) => (await api.patch('/auth/profile', payload)).data,
  changePassword: async (payload: { currentPassword: string; newPassword: string }) => (await api.patch('/auth/password', payload)).data,
  confirmPasswordChange: async (payload: { code: string }) => (await api.post('/auth/password/confirm', payload)).data,
};

export const passwordRecoveryApi = {
  requestCode: async (payload: { email: string }) => (await api.post('/auth/password/forgot', payload)).data,
  reset: async (payload: { email: string; code: string; newPassword: string }) => (await api.post('/auth/password/reset', payload)).data,
};

export const accountsApi = {
  list: async () => (await api.get<Account[]>('/accounts')).data,
  create: async (payload: Partial<Account>) => (await api.post<Account>('/accounts', payload)).data,
  update: async (id: string, payload: Partial<Account>) => (await api.patch<Account>(`/accounts/${id}`, payload)).data,
  remove: async (id: string) => (await api.delete(`/accounts/${id}`)).data,
};

export const categoriesApi = {
  list: async () => (await api.get<Category[]>('/categories')).data,
  create: async (payload: Partial<Category>) => (await api.post<Category>('/categories', payload)).data,
  update: async (id: string, payload: Partial<Category>) => (await api.patch<Category>(`/categories/${id}`, payload)).data,
  remove: async (id: string) => (await api.delete(`/categories/${id}`)).data,
};

export const transactionsApi = {
  list: async (params?: Record<string, unknown>) => (await api.get('/transactions', { params })).data,
  create: async (payload: Partial<Transaction>) => (await api.post<Transaction>('/transactions', payload)).data,
  update: async (id: string, payload: Partial<Transaction>) => (await api.patch<Transaction>(`/transactions/${id}`, payload)).data,
  remove: async (id: string) => (await api.delete(`/transactions/${id}`)).data,
  exportCsv: async (params?: Record<string, unknown>) => (await api.get('/transactions/export', { params, responseType: 'blob' })).data as Blob,
};

export const transfersApi = {
  list: async (params?: Record<string, unknown>) => (await api.get('/transfers', { params })).data,
  create: async (payload: Partial<Transfer>) => (await api.post<Transfer>('/transfers', payload)).data,
  update: async (id: string, payload: Partial<Transfer>) => (await api.patch<Transfer>(`/transfers/${id}`, payload)).data,
  remove: async (id: string) => (await api.delete(`/transfers/${id}`)).data,
};

export const dashboardApi = {
  get: async (params?: Record<string, unknown>) => (await api.get('/dashboard', { params })).data,
};

export const loansApi = {
  list: async (params?: Record<string, unknown>) => (await api.get('/loans', { params })).data,
  create: async (payload: Partial<Loan>) => (await api.post<Loan>('/loans', payload)).data,
  update: async (id: string, payload: Partial<Loan>) => (await api.patch<Loan>(`/loans/${id}`, payload)).data,
  remove: async (id: string) => (await api.delete(`/loans/${id}`)).data,
  createPayment: async (loanId: string, payload: Partial<LoanPayment>) => (await api.post<LoanPayment>(`/loans/${loanId}/payments`, payload)).data,
  removePayment: async (loanId: string, paymentId: string) => (await api.delete(`/loans/${loanId}/payments/${paymentId}`)).data,
};

export const historyApi = {
  list: async (params?: Record<string, unknown>) => (await api.get('/history', { params })).data,
  exportCsv: async (params?: Record<string, unknown>) => (await api.get('/history/export', { params, responseType: 'blob' })).data as Blob,
};

export const usersApi = {
  list: async () => (await api.get<User[]>('/users')).data,
  create: async (payload: { username: string; password: string; name: string; documentSuffix: string }) => (await api.post<User>('/users', payload)).data,
  update: async (id: string, payload: { name?: string; isActive?: boolean; password?: string }) => (await api.patch<User>(`/users/${id}`, payload)).data,
};

export const productsApi = {
  list: async (params?: Record<string, unknown>) => (await api.get<Product[]>('/products', { params })).data,
  create: async (payload: { description: string }) => (await api.post<Product>('/products', payload)).data,
  update: async (id: string, payload: { description?: string; isActive?: boolean }) => (await api.patch<Product>(`/products/${id}`, payload)).data,
};

export const ordersApi = {
  list: async (params?: Record<string, unknown>) => (await api.get<PaginatedResult<Order>>('/orders', { params })).data,
  create: async (payload: {
    clientId: string;
    deliveryAddress: string;
    clientPhone: string;
    paymentMethod: 'CASH' | 'BANK';
    observations?: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  }) =>
    (await api.post<Order>('/orders', payload)).data,
  setInvoiced: async (id: string, isInvoiced: boolean) => (await api.patch<Order>(`/orders/${id}/invoiced`, { isInvoiced })).data,
  ticketPdf: async (id: string) => (await api.get(`/orders/${id}/pdf`, { responseType: 'blob' })).data as Blob,
};

export const clientsApi = {
  list: async (params?: Record<string, unknown>) => (await api.get<PaginatedResult<Client>>('/clients', { params })).data,
  create: async (payload: Partial<Client>) => (await api.post<Client>('/clients', payload)).data,
  update: async (id: string, payload: Partial<Client>) => (await api.patch<Client>(`/clients/${id}`, payload)).data,
};

export const expenseCategoriesApi = {
  list: async () => (await api.get<ExpenseCategory[]>('/expense-categories')).data,
  create: async (payload: { name: string }) => (await api.post<ExpenseCategory>('/expense-categories', payload)).data,
  update: async (id: string, payload: Partial<ExpenseCategory>) => (await api.patch<ExpenseCategory>(`/expense-categories/${id}`, payload)).data,
};

export const incomesApi = {
  list: async (params?: Record<string, unknown>) => (await api.get<PaginatedResult<CashIncome>>('/incomes', { params })).data,
  create: async (payload: Partial<CashIncome>) => (await api.post<CashIncome>('/incomes', payload)).data,
  void: async (id: string, payload: { reason?: string }) => (await api.patch<CashIncome>(`/incomes/${id}/void`, payload)).data,
  setCaused: async (id: string, isCaused: boolean) => (await api.patch<CashIncome>(`/incomes/${id}/caused`, { isCaused })).data,
  exportExcel: async (params?: Record<string, unknown>) => (await api.get('/incomes/export/excel', { params, responseType: 'blob' })).data as Blob,
  exportPdf: async (params?: Record<string, unknown>) => (await api.get('/incomes/export/pdf', { params, responseType: 'blob' })).data as Blob,
  receiptPdf: async (id: string) => (await api.get(`/incomes/${id}/pdf`, { responseType: 'blob' })).data as Blob,
};

export const expensesApi = {
  list: async (params?: Record<string, unknown>) => (await api.get<PaginatedResult<CashExpense>>('/expenses', { params })).data,
  create: async (payload: Partial<CashExpense>) => (await api.post<CashExpense>('/expenses', payload)).data,
  void: async (id: string, payload: { reason?: string }) => (await api.patch<CashExpense>(`/expenses/${id}/void`, payload)).data,
  setCaused: async (id: string, isCaused: boolean) => (await api.patch<CashExpense>(`/expenses/${id}/caused`, { isCaused })).data,
  exportExcel: async (params?: Record<string, unknown>) => (await api.get('/expenses/export/excel', { params, responseType: 'blob' })).data as Blob,
  exportPdf: async (params?: Record<string, unknown>) => (await api.get('/expenses/export/pdf', { params, responseType: 'blob' })).data as Blob,
  receiptPdf: async (id: string) => (await api.get(`/expenses/${id}/pdf`, { responseType: 'blob' })).data as Blob,
};
