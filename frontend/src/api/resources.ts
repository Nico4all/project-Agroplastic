import { Account, Category, Loan, LoanPayment, Transaction, Transfer } from '../types';
import { api } from './client';

export const profileApi = {
  update: async (payload: { name: string; email: string }) => (await api.patch('/auth/profile', payload)).data,
  changePassword: async (payload: { currentPassword: string; newPassword: string }) => (await api.patch('/auth/password', payload)).data,
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
