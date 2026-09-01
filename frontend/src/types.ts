export type AccountType = 'CASH' | 'BANK' | 'SAVINGS' | 'CREDIT_CARD' | 'DIGITAL_WALLET' | 'OTHER';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type LoanType = 'RECEIVABLE' | 'PAYABLE';
export type LoanStatus = 'OPEN' | 'PAID';
export type UserRole = 'ADMIN' | 'BODEGA' | 'SUPERADMIN';
export type IncomeType = 'ADVANCE' | 'RECEIVABLE_PAYMENT';
export type PaymentMethod = 'CASH' | 'BANK';
export type OrderPaymentMethod = 'CASH' | 'BANK' | 'CREDIT';
export type RecordStatus = 'ACTIVE' | 'VOID';

export type PointOfSale = {
  id: string;
  name: string;
  code: string;
  documentPrefix: string;
  nextIncomeNumber?: number;
  nextExpenseNumber?: number;
  nextOrderNumber?: number;
  nextInventoryEntryNumber?: number;
  nextPortfolioCollectionNumber?: number;
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
  createdBy?: Pick<User, 'id' | 'name' | 'username'>;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  isActive: boolean;
};

export type CashIncome = {
  id: string;
  userId: string;
  pointOfSaleId?: string | null;
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
  user?: Pick<User, 'id' | 'name' | 'username' | 'role'>;
  pointOfSale?: Pick<PointOfSale, 'id' | 'name' | 'code' | 'documentPrefix'> | null;
  client?: Pick<Client, 'id' | 'fullName' | 'identityDocument'>;
};

export type CashExpense = {
  id: string;
  userId: string;
  pointOfSaleId?: string | null;
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
  user?: Pick<User, 'id' | 'name' | 'username' | 'role'>;
  pointOfSale?: Pick<PointOfSale, 'id' | 'name' | 'code' | 'documentPrefix'> | null;
  category?: Pick<ExpenseCategory, 'id' | 'name'>;
};

export type Product = {
  id: string;
  inventoryStockId: string;
  pointOfSaleId: string;
  pointOfSale?: Pick<PointOfSale, 'id' | 'name'>;
  description: string;
  quantity: number;
  isActive: boolean;
};

export type InventoryStock = {
  id: string;
  productId: string;
  pointOfSaleId: string;
  pointOfSale?: Pick<PointOfSale, 'id' | 'name'>;
  productDescription: string;
  quantity: number;
  isActive: boolean;
  updatedAt: string;
};

export type InventoryEntryItem = {
  id: string;
  productId: string;
  productDescription: string;
  quantity: number;
};

export type InventoryEntry = {
  id: string;
  userId: string;
  pointOfSaleId: string;
  documentSequence: number;
  documentNumber: string;
  supplierName: string;
  remittanceNumber?: string | null;
  observations?: string | null;
  entryDate: string;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'username'>;
  pointOfSale?: Pick<PointOfSale, 'id' | 'name' | 'code'>;
  items: InventoryEntryItem[];
};

export type ProductHistoryRow = {
  id: string;
  date: string;
  movementType: 'ENTRY' | 'ORDER';
  documentId: string;
  documentNumber: string;
  thirdPartyName: string;
  thirdPartyDocument?: string | null;
  quantityInput: number;
  quantityOutput: number;
  inventoryBefore: number;
  inventoryAfter: number;
  detail: string;
  orderStatus?: RecordStatus | null;
  invoicedAt?: string | null;
  userName: string;
};

export type ProductHistoryResult = PaginatedResult<ProductHistoryRow> & {
  summary: {
    movements: number;
    entries: number;
    orders: number;
    totalInput: number;
    totalOutput: number;
    currentInventory: number;
  };
  product: { id: string; description: string };
  pointOfSale: Pick<PointOfSale, 'id' | 'name' | 'code'>;
};

export type Supplier = {
  id: string;
  name: string;
  isActive: boolean;
  _count?: { products: number };
};

export type PriceListCategory = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  _count?: { products: number };
};

export type PriceListProduct = {
  id: string;
  categoryId: string;
  supplierId: string;
  reference: string;
  measure?: string | null;
  presentation?: string | null;
  primaryPriceLabel: string;
  secondaryPriceLabel: string;
  primaryPrice?: number | null;
  secondaryPrice?: number | null;
  primaryPriceNote?: string | null;
  secondaryPriceNote?: string | null;
  pointOfSaleId?: string | null;
  isActive: boolean;
  category: PriceListCategory;
  supplier: Supplier;
};

export type OrderItem = {
  id: string;
  productId: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderPayment = {
  id: string;
  method: OrderPaymentMethod;
  amount: number;
};

export type PortfolioCollection = {
  id: string;
  userId?: string;
  pointOfSaleId?: string;
  orderId?: string;
  documentNumber: string;
  paymentMethod: PaymentMethod;
  amount: number;
  collectionDate: string;
  description?: string | null;
  causedAt?: string | null;
  user?: Pick<User, 'id' | 'name' | 'username' | 'role'>;
  pointOfSale?: Pick<PointOfSale, 'id' | 'name' | 'code'>;
  order?: {
    id: string;
    documentNumber: string;
    clientId: string;
    clientName: string;
    clientDocument: string;
    invoicedAt?: string | null;
  };
};

export type Order = {
  id: string;
  userId: string;
  pointOfSaleId?: string | null;
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
  status: RecordStatus;
  inventoryAppliedAt?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'username' | 'role'>;
  pointOfSale?: Pick<PointOfSale, 'id' | 'name' | 'code' | 'documentPrefix'> | null;
  client?: Pick<Client, 'id' | 'fullName' | 'identityDocument'>;
  items: OrderItem[];
  payments: OrderPayment[];
  collections?: PortfolioCollection[];
  creditAmount: number;
  collectedAmount: number;
  balanceDue: number;
};

export type PortfolioOrder = {
  id: string;
  clientId: string;
  clientName: string;
  clientDocument: string;
  documentNumber: string;
  pointOfSaleId?: string | null;
  pointOfSale?: Pick<PointOfSale, 'id' | 'name' | 'code'> | null;
  createdAt: string;
  invoicedAt?: string | null;
  totalAmount: number;
  creditAmount: number;
  collectedAmount: number;
  balanceDue: number;
  collections: PortfolioCollection[];
};

export type PortfolioClient = {
  clientId: string;
  clientName: string;
  clientDocument: string;
  totalCredit: number;
  collectedAmount: number;
  balanceDue: number;
  orders: PortfolioOrder[];
};

export type PortfolioResult = {
  summary: {
    clients: number;
    orders: number;
    totalCredit: number;
    collectedAmount: number;
    balanceDue: number;
  };
  clients: PortfolioClient[];
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
