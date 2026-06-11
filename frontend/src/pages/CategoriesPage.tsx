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
  X,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { categoriesApi } from '../api/resources';
import { Category, CategoryType } from '../types';
import { Toggle, useToast } from '../ui/components';

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

function CategoryIcon({ value }: { value?: string | null }) {
  const item = categoryIcons.find((icon) => icon.value === value);
  const Icon = item?.icon || Sparkles;
  return <Icon size={18} />;
}

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
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
  const [form, setForm] = useState({ name: '', type: 'EXPENSE' as CategoryType, color: '#0F9B62', icon: 'sparkles' });
  const [editing, setEditing] = useState<Record<string, { name: string; type: CategoryType; color: string; icon: string }>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync(form);
    setForm({ name: '', type: 'EXPENSE', color: '#0F9B62', icon: 'sparkles' });
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-ink">Categorias</h1>
        <p className="text-sm text-mute">Ingreso y gasto con color e icono para reportes.</p>
      </div>
      <form onSubmit={submit} className="panel grid gap-3 md:grid-cols-[1fr_160px_120px_auto]">
        <input className="input" placeholder="Nombre" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <select className="input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as CategoryType })}>
          <option value="EXPENSE">Gasto</option>
          <option value="INCOME">Ingreso</option>
        </select>
        <input className="input h-10" type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
        <button className="btn-primary"><Plus size={18} /> Crear</button>
        <div className="md:col-span-4">
          <span className="label">Icono</span>
          <CategoryIconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
        </div>
      </form>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.map((category) => (
          <article key={category.id} className="panel">
            {editing[category.id] ? (
              <div className="space-y-3">
                <input className="input" value={editing[category.id].name} onChange={(event) => setEditing({ ...editing, [category.id]: { ...editing[category.id], name: event.target.value } })} />
                <select className="input" value={editing[category.id].type} onChange={(event) => setEditing({ ...editing, [category.id]: { ...editing[category.id], type: event.target.value as CategoryType } })}>
                  <option value="EXPENSE">Gasto</option>
                  <option value="INCOME">Ingreso</option>
                </select>
                <input className="input h-10" type="color" value={editing[category.id].color || '#64748b'} onChange={(event) => setEditing({ ...editing, [category.id]: { ...editing[category.id], color: event.target.value } })} />
                <div>
                  <span className="label">Icono</span>
                  <CategoryIconPicker value={editing[category.id].icon || 'sparkles'} onChange={(icon) => setEditing({ ...editing, [category.id]: { ...editing[category.id], icon } })} />
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary"
                    onClick={() => {
                      update.mutate({ id: category.id, payload: editing[category.id] });
                      const next = { ...editing };
                      delete next[category.id];
                      setEditing(next);
                    }}
                  >
                    <Check size={17} /> Guardar
                  </button>
                  <button
                    className="btn-soft"
                    onClick={() => {
                      const next = { ...editing };
                      delete next[category.id];
                      setEditing(next);
                    }}
                  >
                    <X size={17} /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: category.color || '#64748b' }}>
                    <CategoryIcon value={category.icon} />
                  </span>
                  <div>
                    <p className="font-bold text-ink">{category.name}</p>
                    <p className="text-sm text-mute">{category.type === 'INCOME' ? 'Ingreso' : 'Gasto'}</p>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold ${category.isActive ? 'bg-brand-soft text-brand-dark' : 'bg-paper text-mute'}`}>
                      {category.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
                <button className="btn-soft px-2" title="Editar" onClick={() => setEditing({ ...editing, [category.id]: { name: category.name, type: category.type, color: category.color || '#64748b', icon: category.icon || 'sparkles' } })}>
                  <Pencil size={17} />
                </button>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-paper px-3 py-2">
              <span className="text-sm font-semibold text-mute">{category.isActive ? 'Categoria activa' : 'Categoria inactiva'}</span>
              <Toggle checked={category.isActive} label="Activar o inactivar categoria" onChange={(value) => update.mutate({ id: category.id, payload: { isActive: value } })} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
