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
  OrderPaymentMethod,
  PortfolioResult,
  PortfolioCollection,
  PointOfSale,
  Product,
  Transaction,
  Transfer,
  User,
  Supplier,
  PriceListCategory,
  PriceListProduct,
  InventoryEntry,
  InventoryAdjustment,
  InventoryTransfer,
  InventoryStock,
  ProductHistoryResult,
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
  create: async (payload: { username: string; password: string; name: string; pointOfSaleId: string }) => (await api.post<User>('/users', payload)).data,
  update: async (id: string, payload: { name?: string; isActive?: boolean; password?: string; pointOfSaleId?: string }) => (await api.patch<User>(`/users/${id}`, payload)).data,
};

export const pointsOfSaleApi = {
  list: async () => (await api.get<PointOfSale[]>('/points-of-sale')).data,
  create: async (payload: { name: string; code: string; documentPrefix: string; city?: string; address?: string }) =>
    (await api.post<PointOfSale>('/points-of-sale', payload)).data,
  update: async (id: string, payload: { name?: string; code?: string; documentPrefix?: string; city?: string; address?: string; isActive?: boolean }) =>
    (await api.patch<PointOfSale>(`/points-of-sale/${id}`, payload)).data,
};

export const productsApi = {
  list: async (params?: Record<string, unknown>) => (await api.get<Product[]>('/products', { params })).data,
  create: async (payload: { description: string; pointOfSaleId: string }) => (await api.post<Product>('/products', payload)).data,
  update: async (id: string, payload: { pointOfSaleId: string; description?: string; isActive?: boolean }) =>
    (await api.patch<Product>(`/products/${id}`, payload)).data,
};

export const inventoryApi = {
  stocks: async (params?: Record<string, unknown>) =>
    (await api.get<InventoryStock[]>('/inventory/stocks', { params })).data,
  exportStocksExcel: async (params?: Record<string, unknown>) =>
    (await api.get('/inventory/stocks/export/excel', { params, responseType: 'blob' })).data as Blob,
  exportStocksPdf: async (params?: Record<string, unknown>) =>
    (await api.get('/inventory/stocks/export/pdf', { params, responseType: 'blob' })).data as Blob,
  productHistory: async (params?: Record<string, unknown>) =>
    (await api.get<ProductHistoryResult>('/inventory/history', { params })).data,
  exportProductHistoryExcel: async (params?: Record<string, unknown>) =>
    (await api.get('/inventory/history/export/excel', { params, responseType: 'blob' })).data as Blob,
  entries: async (params?: Record<string, unknown>) =>
    (await api.get<PaginatedResult<InventoryEntry>>('/inventory/entries', { params })).data,
  createEntry: async (payload: {
    pointOfSaleId?: string;
    supplierName: string;
    remittanceNumber?: string;
    observations?: string;
    entryDate: string;
    items: Array<{ productId: string; quantity: number }>;
  }) => (await api.post<InventoryEntry>('/inventory/entries', payload)).data,
  adjustStock: async (payload: {
    pointOfSaleId: string;
    productId: string;
    operation: 'ADD' | 'SUBTRACT';
    quantity: number;
    observation?: string;
  }) => (await api.post<InventoryAdjustment>('/inventory/adjustments', payload)).data,
  updateAdjustment: async (id: string, payload: { quantity: number; observation?: string }) =>
    (await api.patch<InventoryAdjustment>(`/inventory/adjustments/${id}`, payload)).data,
  voidAdjustment: async (id: string, payload: { reason?: string }) =>
    (await api.patch<InventoryAdjustment>(`/inventory/adjustments/${id}/void`, payload)).data,
  adjustments: async (params?: Record<string, unknown>) =>
    (await api.get<PaginatedResult<InventoryAdjustment>>('/inventory/adjustments', { params })).data,
  createTransfer: async (payload: {
    originPointOfSaleId: string;
    destinationPointOfSaleId: string;
    productId: string;
    quantity: number;
    observation?: string;
  }) => (await api.post<InventoryTransfer>('/inventory/transfers', payload)).data,
  transfers: async (params?: Record<string, unknown>) =>
    (await api.get<PaginatedResult<InventoryTransfer>>('/inventory/transfers', { params })).data,
};

export const suppliersApi = {
  list: async () => (await api.get<Supplier[]>('/suppliers')).data,
  create: async (payload: { name: string }) => (await api.post<Supplier>('/suppliers', payload)).data,
  update: async (id: string, payload: { name?: string; isActive?: boolean }) =>
    (await api.patch<Supplier>(`/suppliers/${id}`, payload)).data,
};

export const priceListApi = {
  categories: async () => (await api.get<PriceListCategory[]>('/price-list/categories')).data,
  createCategory: async (payload: { name: string }) =>
    (await api.post<PriceListCategory>('/price-list/categories', payload)).data,
  products: async (params?: Record<string, unknown>) =>
    (await api.get<PriceListProduct[]>('/price-list/products', { params })).data,
  exportExcel: async (pointOfSaleId?: string) =>
    (await api.get('/price-list/products/export/excel', {
      params: pointOfSaleId ? { pointOfSaleId } : undefined,
      responseType: 'blob',
    })).data as Blob,
  createProduct: async (payload: {
    categoryId: string;
    supplierId: string;
    reference: string;
    measure?: string;
    presentation?: string;
    primaryPriceLabel: string;
    secondaryPriceLabel: string;
    primaryPrice?: number;
    secondaryPrice?: number;
    primaryPriceNote?: string;
    secondaryPriceNote?: string;
  }) => (await api.post<PriceListProduct>('/price-list/products', payload)).data,
  updateProduct: async (id: string, payload: Partial<Pick<PriceListProduct,
    'categoryId' | 'supplierId' | 'reference' | 'measure' | 'presentation' | 'primaryPriceLabel' | 'secondaryPriceLabel' |
    'isActive' | 'pointOfSaleId' | 'primaryPrice' | 'secondaryPrice' | 'primaryPriceNote' | 'secondaryPriceNote'>>
  ) => (await api.patch<PriceListProduct>(`/price-list/products/${id}`, payload)).data,
  bulkUpdatePrices: async (payload: {
    pointOfSaleId: string;
    updates: Array<{ productId: string; primaryPrice?: number | null; secondaryPrice?: number | null }>;
  }) => (await api.patch<{ updated: number; pointOfSaleId: string }>('/price-list/products/prices/bulk', payload)).data,
};

export const ordersApi = {
  list: async (params?: Record<string, unknown>) => (await api.get<PaginatedResult<Order>>('/orders', { params })).data,
  exportMovementsExcel: async (params: { fromDate: string; toDate: string }) =>
    (await api.get('/orders/export/excel', { params, responseType: 'blob' })).data as Blob,
  exportMovementsPdf: async (params: { fromDate: string; toDate: string }) =>
    (await api.get('/orders/export/pdf', { params, responseType: 'blob' })).data as Blob,
  create: async (payload: {
    clientId: string;
    deliveryAddress: string;
    clientPhone: string;
    observations?: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    payments: Array<{ method: OrderPaymentMethod; amount: number }>;
  }) =>
    (await api.post<Order>('/orders', payload)).data,
  setInvoiced: async (id: string, isInvoiced: boolean) => (await api.patch<Order>(`/orders/${id}/invoiced`, { isInvoiced })).data,
  void: async (id: string, reason?: string) => (await api.patch<Order>(`/orders/${id}/void`, { reason })).data,
  ticketPdf: async (id: string) => (await api.get(`/orders/${id}/pdf`, { responseType: 'blob' })).data as Blob,
};

export const portfolioApi = {
  list: async (params?: Record<string, unknown>) => (await api.get<PortfolioResult>('/portfolio', { params })).data,
  collect: async (payload: {
    orderId: string;
    paymentMethod: 'CASH' | 'BANK';
    amount: number;
    collectionDate: string;
    description?: string;
  }) => (await api.post('/portfolio/collections', payload)).data,
  collections: async (params?: Record<string, unknown>) =>
    (await api.get<PaginatedResult<PortfolioCollection>>('/portfolio/collections', { params })).data,
  setCollectionCaused: async (id: string, isCaused: boolean) =>
    (await api.patch<PortfolioCollection>(`/portfolio/collections/${id}/caused`, { isCaused })).data,
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
