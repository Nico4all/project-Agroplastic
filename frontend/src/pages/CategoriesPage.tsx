import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  Bus,
  Car,
  Check,
  Clapperboard,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Pencil,
  PiggyBank,
  Pizza,
  Plane,
  Plus,
  Receipt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Utensils,
  Wallet,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { categoriesApi } from '../api/resources';
import { Category, CategoryType } from '../types';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Spinner, Toggle, useToast } from '../ui/components';

const COLOR_SWATCHES = [
  '#0F9B62',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#5667CE',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
  '#DD4A48',
  '#ef4444',
  '#f59e0b',
  '#C8A24B',
  '#64748b',
  '#16251E',
];

const categoryIcons = [
  { value: 'utensils', label: 'Comida', icon: Utensils },
  { value: 'pizza', label: 'Restaurante', icon: Pizza },
  { value: 'bus', label: 'Transporte', icon: Bus },
  { value: 'car', label: 'Auto', icon: Car },
  { value: 'home', label: 'Hogar', icon: Home },
  { value: 'receipt', label: 'Servicios', icon: Receipt },
  { value: 'heart-pulse', label: 'Salud', icon: HeartPulse },
  { value: 'graduation-cap', label: 'Educacion', icon: GraduationCap },
  { value: 'clapperboard', label: 'Entretenimiento', icon: Clapperboard },
  { value: 'shopping-bag', label: 'Compras', icon: ShoppingBag },
  { value: 'plane', label: 'Viajes', icon: Plane },
  { value: 'smartphone', label: 'Telefono', icon: Smartphone },
  { value: 'banknote', label: 'Salario', icon: Banknote },
  { value: 'briefcase', label: 'Trabajo', icon: BriefcaseBusiness },
  { value: 'laptop', label: 'Freelance', icon: Laptop },
  { value: 'piggy-bank', label: 'Ahorro', icon: PiggyBank },
  { value: 'wallet', label: 'Billetera', icon: Wallet },
  { value: 'book-open', label: 'Libro', icon: BookOpen },
  { value: 'dumbbell', label: 'Deporte', icon: Dumbbell },
  { value: 'sparkles', label: 'Otros', icon: Sparkles },
];

type CategoryFormState = {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
};

const emptyForm: CategoryFormState = {
  name: '',
  type: 'EXPENSE',
  color: COLOR_SWATCHES[0],
  icon: 'sparkles',
};

function CategoryIconPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {categoryIcons.map((item) => {
        const Icon = item.icon;
        const selected = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            title={item.label}
            aria-label={item.label}
            onClick={() => onChange(item.value)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${
              selected ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-surface text-mute hover:bg-paper hover:text-ink'
            }`}
          >
            <Icon size={18} />
          </button>
        );
      })}
    </div>
  );
}

function CategoryIcon({ value, className = '' }: { value?: string | null; className?: string }) {
  const item = categoryIcons.find((icon) => icon.value === value);
  const Icon = item?.icon || Sparkles;
  return <Icon className={className} size={18} />;
}

function CategoryModal({
  open,
  editing,
  form,
  busy,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean;
  editing: Category | null;
  form: CategoryFormState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onChange: (form: CategoryFormState) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar categoria' : form.type === 'INCOME' ? 'Nueva categoria de ingreso' : 'Nueva categoria de gasto'}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nombre">
          <Input
            required
            maxLength={100}
            placeholder={form.type === 'INCOME' ? 'Ej. Salario, Freelance...' : 'Ej. Mercado, Servicios...'}
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
          />
        </Field>

        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                onClick={() => onChange({ ...form, color })}
                className={`h-8 w-8 rounded-full transition ${
                  form.color === color ? 'ring-2 ring-ink ring-offset-2' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </Field>

        <Field label="Icono">
          <CategoryIconPicker value={form.icon} onChange={(icon) => onChange({ ...form, icon })} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear categoria'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CategorySection({
  type,
  title,
  categories,
  onCreate,
  onEdit,
  onToggle,
}: {
  type: CategoryType;
  title: string;
  categories: Category[];
  onCreate: (type: CategoryType) => void;
  onEdit: (category: Category) => void;
  onToggle: (category: Category, isActive: boolean) => void;
}) {
  const list = categories.filter((category) => category.type === type);
  const activeCount = list.filter((category) => category.isActive).length;
  const tone = type === 'INCOME' ? 'income' : 'expense';

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold">{title}</h2>
            <Badge tone={tone}>{list.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-mute">{activeCount} activas</p>
        </div>
        <Button variant="secondary" onClick={() => onCreate(type)}>
          <Plus className="h-4 w-4" /> Anadir
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState title={`Sin categorias de ${title.toLowerCase()}`} />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((category) => (
            <li key={category.id} className="flex items-center gap-3 py-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: category.color || '#64748b' }}
              >
                <CategoryIcon value={category.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{category.name}</p>
                <p className="text-xs text-mute">{category.isActive ? 'Activa' : 'Inactiva'}</p>
              </div>
              <Toggle
                checked={category.isActive}
                label={`Activar o inactivar ${category.name}`}
                onChange={(value) => onToggle(category, value)}
              />
              <Button variant="ghost" className="px-2" title="Editar" onClick={() => onEdit(category)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyForm);

  const create = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast('Categoria creada');
    },
    onError: () => toast('No se pudo guardar la categoria', 'error'),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Category> }) => categoriesApi.update(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if ('isActive' in variables.payload) toast(variables.payload.isActive ? 'Categoria activada' : 'Categoria inactivada');
      else toast('Categoria actualizada');
    },
    onError: () => toast('No se pudo actualizar la categoria', 'error'),
  });

  const openCreate = (type: CategoryType) => {
    setEditing(null);
    setForm({ ...emptyForm, type, icon: type === 'INCOME' ? 'banknote' : 'sparkles' });
    setModalOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name,
      type: category.type,
      color: category.color || COLOR_SWATCHES[0],
      icon: category.icon || 'sparkles',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      name: form.name,
      color: form.color,
      icon: form.icon,
      ...(editing ? {} : { type: form.type }),
    };

    try {
      if (editing) await update.mutateAsync({ id: editing.id, payload });
      else await create.mutateAsync(payload);

      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
    } catch {
      // El toast de error lo maneja la mutacion correspondiente.
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Categorias</h1>
        <p className="text-sm text-mute">Organiza tus ingresos y gastos con tus propias categorias.</p>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <CategorySection
            type="INCOME"
            title="Ingresos"
            categories={data}
            onCreate={openCreate}
            onEdit={openEdit}
            onToggle={(category, isActive) => update.mutate({ id: category.id, payload: { isActive } })}
          />
          <CategorySection
            type="EXPENSE"
            title="Gastos"
            categories={data}
            onCreate={openCreate}
            onEdit={openEdit}
            onToggle={(category, isActive) => update.mutate({ id: category.id, payload: { isActive } })}
          />
        </div>
      )}

      <CategoryModal
        open={modalOpen}
        editing={editing}
        form={form}
        busy={create.isPending || update.isPending}
        onClose={closeModal}
        onSubmit={submit}
        onChange={setForm}
      />
    </section>
  );
}
