import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Inbox,
  Search,
  X,
} from 'lucide-react';
import {
  ButtonHTMLAttributes,
  createContext,
  ReactNode,
  SelectHTMLAttributes,
  InputHTMLAttributes,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark focus-visible:ring-brand/40 shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-paper focus-visible:ring-brand/30',
  danger: 'bg-expense text-white hover:bg-expense/90 focus-visible:ring-expense/40 shadow-sm',
  ghost: 'text-mute hover:bg-paper hover:text-ink focus-visible:ring-brand/30',
};

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${props.className ?? ''}`} />;
}

export type SearchableSelectOption = {
  value: string;
  label: string;
  searchText?: string;
};

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO')
    .trim();
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Escribe para buscar',
  emptyMessage = 'Sin coincidencias',
  disabled = false,
}: {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(selected?.label ?? '');
  }, [selected?.label, value]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const filteredOptions = useMemo(() => {
    const selectedLabel = selected?.label ?? '';
    const effectiveQuery = query === selectedLabel ? '' : normalizeSearch(query);
    if (!effectiveQuery) return options;
    return options.filter((option) => normalizeSearch(`${option.label} ${option.searchText ?? ''}`).includes(effectiveQuery));
  }, [options, query, selected?.label]);

  const selectOption = (option: SearchableSelectOption) => {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-mute" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        className="input pl-9 pr-10"
        onFocus={(event) => {
          setOpen(true);
          setActiveIndex(0);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange('');
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === 'Enter' && open && filteredOptions[activeIndex]) {
            event.preventDefault();
            selectOption(filteredOptions[activeIndex]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Mostrar opciones"
        disabled={disabled}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-mute hover:bg-paper"
        onClick={() => {
          setOpen((current) => !current);
          inputRef.current?.focus();
        }}
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      {open && !disabled && (
        <div role="listbox" className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-xl">
          {filteredOptions.length ? filteredOptions.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm transition ${index === activeIndex ? 'bg-brand-soft text-brand-dark' : 'hover:bg-paper'} ${option.value === value ? 'font-semibold' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
            >
              {option.label}
            </button>
          )) : (
            <p className="px-3 py-3 text-sm text-mute">{emptyMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${checked ? 'bg-brand' : 'bg-line'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export function Badge({ tone, children }: { tone: 'income' | 'expense' | 'transfer' | 'neutral'; children: ReactNode }) {
  const tones = {
    income: 'bg-brand-soft text-brand-dark',
    expense: 'bg-expense-soft text-expense',
    transfer: 'bg-transfer-soft text-transfer',
    neutral: 'bg-paper text-mute',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-10 ${className}`}>
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-brand" />
    </div>
  );
}

export function EmptyState({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Inbox className="h-10 w-10 text-line" strokeWidth={1.5} />
      <p className="font-semibold text-ink">{title}</p>
      {subtitle && <p className="max-w-sm text-sm text-mute">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1 text-mute transition hover:bg-paper hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Eliminar',
  busyLabel = 'Procesando...',
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-expense-soft p-2">
          <AlertTriangle className="h-5 w-5 text-expense" />
        </div>
        <p className="text-sm text-mute">{message}</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</Button>
      </div>
    </Modal>
  );
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-3 text-sm">
      <span className="text-mute">Pagina {page} de {pages} - {total} registros</span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente</Button>
      </div>
    </div>
  );
}

type Toast = {
  id: number;
  message: string;
  tone: 'success' | 'error';
};

const ToastContext = createContext<{ toast: (message: string, tone?: 'success' | 'error') => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((toastItem) => (
          <div key={toastItem.id} className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toastItem.tone === 'success' ? 'bg-ink' : 'bg-expense'}`}>
            {toastItem.tone === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {toastItem.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider');
  return context.toast;
}
