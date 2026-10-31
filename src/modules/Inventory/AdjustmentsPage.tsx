import { useMemo, useState } from 'react';
import { Sliders, Search } from 'lucide-react';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useCatalogStore } from '@/store/useCatalogStore';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export default function AdjustmentsPage(): React.JSX.Element {
  const adjustments = useInventoryStore((state) => state.adjustments);
  const products = useCatalogStore((state) => state.products);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return adjustments.filter((a) => {
      const product = products.find((p) => p.id === a.productId);
      const haystack = `${a.productName} ${a.reason} ${a.issuer} ${product?.sku ?? ''}`.toLowerCase();
      return term ? haystack.includes(term) : true;
    });
  }, [adjustments, products, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inventario"
        title="Ajustes de inventario"
        description="Historial de ajustes absolutos de stock, con stock anterior, nuevo, diferencia, motivo y autorizante."
        icon={<Sliders className="h-5 w-5" />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Ajustes" value={String(adjustments.length)} hint="Registrados" icon={<Sliders />} accent="blue" />
        <StatCard label="Productos afectados" value={String(new Set(adjustments.map((a) => a.productId)).size)} hint="Distintos" icon={<Sliders />} accent="sky" />
        <StatCard label="Último ajuste" value={adjustments.length ? new Date(adjustments[0].createdAt).toLocaleDateString('es-NI') : '—'} hint="Fecha" icon={<Sliders />} accent="emerald" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-border p-3.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ajuste…" className="h-8 flex-1 bg-transparent text-xs outline-none" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<Sliders />} title="Sin ajustes" description="No hay ajustes de inventario registrados." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Artículo</TableHead>
                <TableHead className="text-right">Stock anterior</TableHead>
                <TableHead className="text-right">Stock nuevo</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Autoriza</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-[11px] text-muted-foreground">{new Date(a.createdAt).toLocaleString('es-NI')}</TableCell>
                  <TableCell className="text-xs font-medium">{a.productName}</TableCell>
                  <TableCell className="num text-right text-xs">{a.previousStock}</TableCell>
                  <TableCell className="num text-right text-xs">{a.newStock}</TableCell>
                  <TableCell className={cn('num text-right text-xs font-semibold', a.difference >= 0 ? 'text-success' : 'text-destructive')}>
                    {a.difference > 0 ? '+' : ''}{a.difference}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{a.reason}</TableCell>
                  <TableCell className="text-[11px]">{a.issuer}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}