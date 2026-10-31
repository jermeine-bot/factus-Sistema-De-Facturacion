import { useMemo } from 'react';
import { Package, AlertTriangle, Layers } from 'lucide-react';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney, formatNumber, stockStatus } from '@/utils/format';

export default function InventoryReportPage(): React.JSX.Element {
  const products = useCatalogStore((state) => state.products);
  const adjustments = useInventoryStore((state) => state.adjustments);
  const settings = useSettingsStore((state) => state.settings);
  const rate = settings.exchangeRate;

  const stats = useMemo(() => {
    const active = products.filter((product) => product.isActive);
    const stockValue = products.reduce(
      (acc, product) => acc + (product.type === 'floating' || product.type === 'integrated' ? 0 : product.stock * product.cost),
      0,
    );
    const critical = products.filter(
      (product) =>
        product.isActive &&
        (product.type === 'common' || product.type === 'grouped') &&
        stockStatus(product.stock, product.minStock) !== 'ok',
    ).length;
    return { active: active.length, stockValue, critical, adjustments: adjustments.length };
  }, [products, adjustments]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { category: string; items: number; stock: number; value: number }>();
    for (const product of products) {
      if (product.type === 'floating' || product.type === 'integrated') continue;
      const entry = map.get(product.category) ?? { category: product.category, items: 0, stock: 0, value: 0 };
      entry.items += 1;
      entry.stock = round2Safe(entry.stock + product.stock);
      entry.value = round2Safe(entry.value + product.stock * product.cost);
      map.set(product.category, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [products]);

  const criticalProducts = useMemo(
    () =>
      products
        .filter(
          (product) =>
            product.isActive &&
            (product.type === 'common' || product.type === 'grouped') &&
            stockStatus(product.stock, product.minStock) !== 'ok',
        )
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 20),
    [products],
  );

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Reportes" title="Reporte de inventario" description="Existencias, valor de inventario y productos con stock crítico." icon={<Package className="h-5 w-5" />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Productos activos" value={String(stats.active)} hint="En catálogo" icon={<Package />} accent="blue" />
        <StatCard label="Valor de inventario" value={formatMoney(stats.stockValue, rate)} hint="Costo de existencias" icon={<Layers />} accent="sky" />
        <StatCard label="Stock crítico" value={String(stats.critical)} hint="Requieren reposición" icon={<AlertTriangle />} accent="rose" />
        <StatCard label="Ajustes registrados" value={String(stats.adjustments)} hint="Movimientos auditados" icon={<Layers />} accent="amber" />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3"><h2 className="font-display text-sm font-semibold">Valor por categoría</h2></div>
          <Table>
            <TableHeader><TableRow><TableHead>Categoría</TableHead><TableHead className="text-right">Ítems</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
            <TableBody>
              {byCategory.map((row) => (
                <TableRow key={row.category}>
                  <TableCell className="text-xs font-medium">{row.category}</TableCell>
                  <TableCell className="num text-right text-xs">{row.items}</TableCell>
                  <TableCell className="num text-right text-xs">{formatNumber(row.stock, 2)}</TableCell>
                  <TableCell className="num text-right text-xs font-semibold">{formatMoney(row.value, rate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3"><h2 className="font-display text-sm font-semibold">Stock crítico</h2></div>
          <Table>
            <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Mínimo</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
            <TableBody>
              {criticalProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="text-xs font-medium">{product.name}</TableCell>
                  <TableCell className="num text-right text-xs">{formatNumber(product.stock, 2)}</TableCell>
                  <TableCell className="num text-right text-xs">{formatNumber(product.minStock, 2)}</TableCell>
                  <TableCell><Badge variant={stockStatus(product.stock, product.minStock) === 'out' ? 'danger' : 'warning'}>{stockStatus(product.stock, product.minStock) === 'out' ? 'Agotado' : 'Bajo'}</Badge></TableCell>
                </TableRow>
              ))}
              {criticalProducts.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">Sin productos críticos.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function round2Safe(value: number): number {
  return Math.round(value * 100) / 100;
}
