import { useMemo, useState } from 'react';
import { FolderTree, Plus, Search, Trash2 } from 'lucide-react';
import { useCatalogStore } from '@/store/useCatalogStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function ArticleGroupsPage(): React.JSX.Element {
  const categories = useCatalogStore((state) => state.categories);
  const products = useCatalogStore((state) => state.products);
  const createCategory = useCatalogStore((state) => state.createCategory);
  const updateCategory = useCatalogStore((state) => state.updateCategory);
  const deleteCategory = useCatalogStore((state) => state.deleteCategory);

  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [error, setError] = useState('');

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return categories.filter((c) => (term ? c.name.toLowerCase().includes(term) : true));
  }, [categories, search]);

  const handleCreate = (): void => {
    setError('');
    if (!name.trim()) {
      setError('El nombre del grupo es obligatorio.');
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('Ya existe un grupo con ese nombre.');
      return;
    }
    createCategory(name, color);
    setName('');
    toast.success('Grupo creado', name.trim());
  };

  const startEdit = (id: string): void => {
    const c = categories.find((x) => x.id === id);
    if (!c) return;
    setEditingId(id);
    setEditName(c.name);
    setEditColor(c.color);
  };

  const saveEdit = (): void => {
    if (!editingId) return;
    try {
      updateCategory(editingId, editName, editColor);
      setEditingId(null);
      toast.success('Grupo actualizado', editName.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar.');
    }
  };

  const handleDelete = (id: string): void => {
    try {
      deleteCategory(id);
      toast.success('Grupo eliminado');
    } catch (e) {
      toast.error('No se pudo eliminar', e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inventario"
        title="Grupos de artículos"
        description="Administra categorías de productos. No se pueden eliminar grupos con artículos asociados."
        icon={<FolderTree className="h-5 w-5" />}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Grupos" value={String(categories.length)} hint="Categorías registradas" icon={<FolderTree />} accent="blue" />
        <StatCard label="Artículos" value={String(products.length)} hint="Total en catálogo" icon={<FolderTree />} accent="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold">Nuevo grupo</p>
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Bebidas" />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn('h-6 w-6 rounded-full border-2', color === c ? 'border-foreground' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-3.5 w-3.5" /> Crear grupo
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-border p-3.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar grupo…"
              className="h-8 flex-1 bg-transparent text-xs outline-none"
            />
          </div>
          {filtered.length === 0 ? (
            <EmptyState icon={<FolderTree />} title="Sin grupos" description="Crea el primer grupo de artículos." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Artículos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const isEditing = editingId === c.id;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex gap-1">
                            {COLORS.map((col) => (
                              <button
                                key={col}
                                type="button"
                                onClick={() => setEditColor(col)}
                                className={cn('h-5 w-5 rounded-full border-2', editColor === col ? 'border-foreground' : 'border-transparent')}
                                style={{ backgroundColor: col }}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-xs" />
                        ) : (
                          <span className="text-xs font-medium">{c.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="num text-right text-xs">{counts.get(c.name) ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={saveEdit}>Guardar</Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancelar</Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon-sm" onClick={() => startEdit(c.id)}>Editar</Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleDelete(c.id)}
                                className="text-destructive/70 hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}