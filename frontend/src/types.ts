export type AccountType = 'CASH' | 'BANK' | 'SAVINGS' | 'CREDIT_CARD' | 'DIGITAL_WALLET' | 'OTHER';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type LoanType = 'RECEIVABLE' | 'PAYABLE';
export type LoanStatus = 'OPEN' | 'PAID';

export type User = {
  id: string;
  name: string;
  email: string;
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
