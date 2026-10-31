import { useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { useSalesStore } from '@/store/useSalesStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney, formatMoneyStat, formatDate } from '@/utils/format';


interface Row {
  saleId: string;
  invoiceNumber: string;
  createdAt: string;
  productId: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export default function SoldItemsPage(): React.JSX.Element {
  const sales = useSalesStore((state) => state.sales);
  const products = useCatalogStore((state) => state.products);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  );

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    for (const sale of sales) {
      if (sale.status === 'void') continue;
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;
      const created = new Date(sale.createdAt);
      if (fromDate && created < fromDate) continue;
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (created > end) continue;
      }
      for (const item of sale.items) {
        const product = products.find((p) => p.id === item.productId);
        result.push({
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          createdAt: sale.createdAt,
          productId: item.productId,
          sku: product?.sku ?? '—',
          name: item.name,
          category: product?.category ?? 'Sin categoría',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.total,
        });
      }
    }
    return result;
  }, [sales, products, from, to]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (category !== 'all' && row.category !== category) return false;
      if (
        term &&
        !`${row.sku} ${row.name} ${row.category} ${row.invoiceNumber}`.toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  }, [rows, search, category]);

  const stats = useMemo(() => {
    const totalQty = filtered.reduce((acc, r) => acc + r.quantity, 0);
    const totalAmount = filtered.reduce((acc, r) => acc + r.total, 0);
    return { totalQty, totalAmount, lines: filtered.length };
  }, [filtered]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Ventas"
        title="Artículos vendidos"
        description="Detalle de todas las líneas de venta registradas, con filtros por período y categoría."
        icon={<Package className="h-5 w-5" />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Líneas de venta" value={String(stats.lines)} hint="Artículos vendidos" icon={<Package />} accent="blue" />
        <StatCard label="Cantidad total" value={stats.totalQty.toLocaleString('es-NI')} hint="Unidades vendidas" icon={<Package />} accent="sky" />
        <StatCard label="Importe total" value={formatMoneyStat(stats.totalAmount, rate)} hint="Ventas brutas" icon={<Package />} accent="emerald" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar artículo, código, factura…" className="w-full lg:max-w-xs" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border border-border bg-muted/40 px-2.5 text-[11px] text-foreground"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'Todas las categorías' : c}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px] text-[11px]" />
            <span className="text-[10px] text-muted-foreground">a</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px] text-[11px]" />
          </div>
          <div className="ml-auto text-[11px] text-muted-foreground">{filtered.length} líneas</div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Package />} title="Sin artículos vendidos" description="No hay ventas en el período seleccionado." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Artículo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Desc.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, idx) => (
                <TableRow key={`${row.saleId}-${idx}`}>
                  <TableCell className="num text-[11px]">{row.sku}</TableCell>
                  <TableCell className="text-xs font-medium">{row.name}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{row.category}</TableCell>
                  <TableCell className="num text-[11px]">{row.invoiceNumber}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                  <TableCell className="num text-right text-xs">{row.quantity}</TableCell>
                  <TableCell className="num text-right text-xs">{formatMoney(row.unitPrice, rate)}</TableCell>
                  <TableCell className="num text-right text-xs">{row.discount}%</TableCell>
                  <TableCell className="num text-right text-xs font-semibold">{formatMoney(row.total, rate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}