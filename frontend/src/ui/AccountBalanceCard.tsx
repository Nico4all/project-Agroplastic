import { Wallet } from 'lucide-react';
import { Account } from '../types';
import { money } from '../utils/format';

type Props = {
  account?: Account;
  label?: string;
  emptyText?: string;
};

export function AccountBalanceCard({ account, label = 'Saldo disponible', emptyText = 'Selecciona una cuenta' }: Props) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
          {account ? (
            <>
              <p className="truncate text-sm font-bold text-ink">{account.name}</p>
              <p className="mt-1 text-xl font-black text-ink">{money(account.currentBalance)}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">{emptyText}</p>
          )}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-mint">
          <Wallet size={20} />
        </div>
      </div>
    </div>
  );
}
