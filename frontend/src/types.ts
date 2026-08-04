export type AccountType = 'CASH' | 'BANK' | 'SAVINGS' | 'CREDIT_CARD' | 'DIGITAL_WALLET' | 'OTHER';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type LoanType = 'RECEIVABLE' | 'PAYABLE';
export type LoanStatus = 'OPEN' | 'PAID';
export type UserRole = 'ADMIN' | 'BODEGA';
export type IncomeType = 'ADVANCE' | 'RECEIVABLE_PAYMENT';
export type PaymentMethod = 'CASH' | 'BANK';
export type OrderPaymentMethod = 'CASH' | 'BANK' | 'CREDIT';
export type RecordStatus = 'ACTIVE' | 'VOID';

export type PointOfSale = {
  id: string;
  name: string;
  code: string;
  city?: string | null;
  address?: string | null;
  isActive: boolean;
  _count?: { users: number };
};

export type User = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  pointOfSaleId?: string | null;
  pointOfSale?: PointOfSale | null;
  documentSuffix: string;
  isActive?: boolean;
  emailVerifiedAt?: string | null;
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currentBalance: number;
  isActive: boolean;
};

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  color?: string;
  icon?: string;
  isActive: boolean;
};

export type Transaction = {
  id: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  description?: string;
  transactionDate: string;
  account?: Pick<Account, 'id' | 'name' | 'type' | 'currentBalance'>;
  category?: Pick<Category, 'id' | 'name' | 'type' | 'color' | 'icon'>;
};

export type Transfer = {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
  transferDate: string;
  fromAccount?: Pick<Account, 'id' | 'name'>;
  toAccount?: Pick<Account, 'id' | 'name'>;
};

export type LoanPayment = {
  id: string;
  loanId: string;
  accountId: string;
  amount: number;
  description?: string;
  paymentDate: string;
  account?: Pick<Account, 'id' | 'name'>;
};

export type Loan = {
  id: string;
  accountId: string;
  personName: string;
  type: LoanType;
  principalAmount: number;
  remainingAmount: number;
  paidAmount: number;
  description?: string;
  loanDate: string;
  status: LoanStatus;
  account?: Pick<Account, 'id' | 'name' | 'type'>;
  payments?: LoanPayment[];
};

export type Client = {
  id: string;
  fullName: string;
  identityDocument: string;
  isActive: boolean;
  createdBy?: Pick<User, 'id' | 'name' | 'username' | 'documentSuffix'>;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  isActive: boolean;
};

export type CashIncome = {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  clientDocument: string;
  documentSequence: number;
  documentNumber: string;
  type: IncomeType;
  paymentMethod: PaymentMethod;
  amount: number;
  description?: string | null;
  incomeDate: string;
  status: RecordStatus;
  causedAt?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  user?: Pick<User, 'id' | 'name' | 'username' | 'documentSuffix' | 'role'>;
  client?: Pick<Client, 'id' | 'fullName' | 'identityDocument'>;
};

export type CashExpense = {
  id: string;
  userId: string;
  categoryId: string;
  documentSequence: number;
  documentNumber: string;
  paidTo: string;
  amount: number;
  appliesRetention: boolean;
  retentionPercentage?: number | null;
  retentionAmount?: number | null;
  description?: string | null;
  approvedBy?: string | null;
  expenseDate: string;
  status: RecordStatus;
  causedAt?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  user?: Pick<User, 'id' | 'name' | 'username' | 'documentSuffix' | 'role'>;
  category?: Pick<ExpenseCategory, 'id' | 'name'>;
};

export type Product = {
  id: string;
  description: string;
  isActive: boolean;
};

export type OrderItem = {
  id: string;
  productId: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  userId: string;
  clientId: string;
  documentSequence: number;
  documentNumber: string;
  clientName: string;
  clientDocument: string;
  deliveryAddress?: string | null;
  clientPhone?: string | null;
  paymentMethod?: OrderPaymentMethod | null;
  observations?: string | null;
  totalAmount: number;
  invoicedAt?: string | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'username' | 'documentSuffix' | 'role'>;
  client?: Pick<Client, 'id' | 'fullName' | 'identityDocument'>;
  items: OrderItem[];
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  summary?: {
    active: number;
    void: number;
  };
};
