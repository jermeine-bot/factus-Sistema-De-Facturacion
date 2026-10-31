import { useMemo, useState } from 'react';
import { Boxes, Search } from 'lucide-react';
import { useCatalogStore } from '@/store/useCatalogStore';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function PresentationsPage(): React.JSX.Element {
  const products = useCatalogStore((state) => state.products);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) =>
      term ? `${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(term) : true,
    );
  }, [products, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inventario"
        title="Presentaciones y combos"
        description="Unidades de medida, ratios de conversión y componentes de productos agrupados."
        icon={<Boxes className="h-5 w-5" />}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-border p-3.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar artículo…" className="h-8 flex-1 bg-transparent text-xs outline-none" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<Boxes />} title="Sin artículos" description="No hay artículos registrados." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artículo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Unidad base</TableHead>
                <TableHead>Presentaciones</TableHead>
                <TableHead>Componentes (combo)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs font-medium">{p.name}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{p.type}</TableCell>
                  <TableCell className="text-[11px]">{p.unit}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {p.units.map((u) => `${u.name} (×${u.ratio})`).join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {p.components.length
                      ? p.components.map((c) => `${c.quantity} × ${c.productId}`).join(', ')
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}