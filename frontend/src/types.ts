export type AccountType = 'CASH' | 'BANK' | 'SAVINGS' | 'CREDIT_CARD' | 'DIGITAL_WALLET' | 'OTHER';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type LoanType = 'RECEIVABLE' | 'PAYABLE';
export type LoanStatus = 'OPEN' | 'PAID';
export type UserRole = 'ADMIN' | 'BODEGA';
export type IncomeType = 'ADVANCE' | 'RECEIVABLE_PAYMENT';
export type PaymentMethod = 'CASH' | 'BANK';
export type RecordStatus = 'ACTIVE' | 'VOID';

export type User = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  city?: string | null;
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
  city?: string | null;
  isGeneral: boolean;
  isActive: boolean;
  createdBy?: Pick<User, 'id' | 'name' | 'username' | 'city'>;
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
  city: string;
  type: IncomeType;
  paymentMethod: PaymentMethod;
  amount: number;
  description?: string | null;
  incomeDate: string;
  status: RecordStatus;
  voidReason?: string | null;
  voidedAt?: string | null;
  user?: Pick<User, 'id' | 'name' | 'username' | 'city' | 'role'>;
  client?: Pick<Client, 'id' | 'fullName' | 'identityDocument' | 'city' | 'isGeneral'>;
};

export type CashExpense = {
  id: string;
  userId: string;
  categoryId: string;
  city: string;
  paidTo: string;
  amount: number;
  description?: string | null;
  approvedBy?: string | null;
  expenseDate: string;
  status: RecordStatus;
  voidReason?: string | null;
  voidedAt?: string | null;
  user?: Pick<User, 'id' | 'name' | 'username' | 'city' | 'role'>;
  category?: Pick<ExpenseCategory, 'id' | 'name'>;
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
