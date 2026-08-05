import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderTree, Pencil, Plus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { expenseCategoriesApi } from '../api/resources';
import { useAuth } from '../state/AuthContext';
import { ExpenseCategory } from '../types';
import { Button, Card, EmptyState, Field, Input, Modal, Spinner, Toggle, useToast } from '../ui/components';
import { isAdminRole } from '../utils/roles';

export function CategoriesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAdmin = isAdminRole(user?.role);
  const { data = [], isLoading } = useQuery({ queryKey: ['expense-categories'], queryFn: expenseCategoriesApi.list });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: expenseCategoriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      toast('Categoria creada');
    },
    onError: () => toast('No se pudo guardar la categoria', 'error'),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ExpenseCategory> }) => expenseCategoriesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      toast('Categoria actualizada');
    },
    onError: () => toast('No se pudo actualizar la categoria', 'error'),
  });

  const openCreate = () => {
    setEditing(null);
    setName('');
    setModalOpen(true);
  };

  const openEdit = (category: ExpenseCategory) => {
    setEditing(category);
    setName(category.name);
    setModalOpen(true);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (editing) await update.mutateAsync({ id: editing.id, payload: { name } });
    else await create.mutateAsync({ name });
    setModalOpen(false);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Categorias de gasto</h1>
          <p className="text-sm text-mute">Descargue, Papeleria, Transporte, Aux de bodega y las que necesite la operacion.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nueva
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : data.length ? (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {data.map((category) => (
              <li key={category.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark">
                  <FolderTree className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{category.name}</p>
                  <p className="text-xs text-mute">{category.isActive ? 'Activa' : 'Inactiva'}</p>
                </div>
                {isAdmin && (
                  <>
                    <Toggle checked={category.isActive} onChange={(isActive) => update.mutate({ id: category.id, payload: { isActive } })} />
                    <Button variant="ghost" className="px-2" title="Editar" onClick={() => openEdit(category)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="Sin categorias" action={<Button onClick={openCreate}>Crear categoria</Button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar categoria' : 'Nueva categoria'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nombre">
            <Input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
