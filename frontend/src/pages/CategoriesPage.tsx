import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Power, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { categoriesApi } from '../api/resources';
import { Category, CategoryType } from '../types';

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const create = useMutation({ mutationFn: categoriesApi.create, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }) });
  const update = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Partial<Category> }) => categoriesApi.update(id, payload), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }) });
  const [form, setForm] = useState({ name: '', type: 'EXPENSE' as CategoryType, color: '#2aa876', icon: '' });
  const [editing, setEditing] = useState<Record<string, { name: string; type: CategoryType; color: string; icon: string }>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync(form);
    setForm({ name: '', type: 'EXPENSE', color: '#2aa876', icon: '' });
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-ink">Categorias</h1>
        <p className="text-sm text-slate-500">Ingreso y gasto con color opcional para reportes.</p>
      </div>
      <form onSubmit={submit} className="panel grid gap-3 md:grid-cols-[1fr_160px_120px_120px_auto]">
        <input className="input" placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CategoryType })}>
          <option value="EXPENSE">Gasto</option>
          <option value="INCOME">Ingreso</option>
        </select>
        <input className="input h-10" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        <input className="input" placeholder="Icono" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
        <button className="btn-primary"><Plus size={18} /> Crear</button>
      </form>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.map((category) => (
          <article key={category.id} className="panel">
            {editing[category.id] ? (
              <div className="space-y-3">
                <input className="input" value={editing[category.id].name} onChange={(e) => setEditing({ ...editing, [category.id]: { ...editing[category.id], name: e.target.value } })} />
                <select className="input" value={editing[category.id].type} onChange={(e) => setEditing({ ...editing, [category.id]: { ...editing[category.id], type: e.target.value as CategoryType } })}>
                  <option value="EXPENSE">Gasto</option>
                  <option value="INCOME">Ingreso</option>
                </select>
                <input className="input h-10" type="color" value={editing[category.id].color || '#64748b'} onChange={(e) => setEditing({ ...editing, [category.id]: { ...editing[category.id], color: e.target.value } })} />
                <input className="input" placeholder="Icono" value={editing[category.id].icon} onChange={(e) => setEditing({ ...editing, [category.id]: { ...editing[category.id], icon: e.target.value } })} />
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => {
                    update.mutate({ id: category.id, payload: editing[category.id] });
                    const next = { ...editing };
                    delete next[category.id];
                    setEditing(next);
                  }}><Check size={17} /> Guardar</button>
                  <button className="btn-soft" onClick={() => {
                    const next = { ...editing };
                    delete next[category.id];
                    setEditing(next);
                  }}><X size={17} /> Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-4 w-4 rounded-full" style={{ background: category.color || '#64748b' }} />
                  <div>
                    <p className="font-bold text-ink">{category.name}</p>
                    <p className="text-sm text-slate-500">{category.type === 'INCOME' ? 'Ingreso' : 'Gasto'} {category.icon ? `· ${category.icon}` : ''}</p>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold ${category.isActive ? 'bg-mint/10 text-mint' : 'bg-slate-100 text-slate-500'}`}>
                      {category.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
                <button className="btn-soft px-2" title="Editar" onClick={() => setEditing({ ...editing, [category.id]: { name: category.name, type: category.type, color: category.color || '#64748b', icon: category.icon || '' } })}>
                  <Pencil size={17} />
                </button>
              </div>
            )}
            <button className="btn-soft mt-3 w-full" onClick={() => update.mutate({ id: category.id, payload: { isActive: !category.isActive } })}>
              <Power size={17} /> {category.isActive ? 'Inactivar categoria' : 'Activar categoria'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
