import { useMemo, useState } from 'react';
import { Calculator, Package } from 'lucide-react';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney, formatMoneyStat } from '@/utils/format';


export default function InventoryValuedPage(): React.JSX.Element {
  const products = useCatalogStore((state) => state.products);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  );

  const rows = useMemo(() => {
    return products
      .filter((p) => p.type !== 'floating' && p.type !== 'integrated')
      .filter((p) => (category === 'all' ? true : p.category === category))
      .filter((p) =>
        search.trim() === ''
          ? true
          : `${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(search.trim().toLowerCase()),
      )
      .map((p) => ({ ...p, value: p.stock * p.cost }))
      .sort((a, b) => b.value - a.value);
  }, [products, search, category]);

  const totalValue = rows.reduce((acc, r) => acc + r.value, 0);
  const totalStock = rows.reduce((acc, r) => acc + r.stock, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inventario"
        title="Inventario valorizado"
        description="Valor del stock actual a costo unitario. Valor = stock disponible × costo unitario."
        icon={<Calculator className="h-5 w-5" />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Artículos" value={String(rows.length)} hint="Con stock físico" icon={<Package />} accent="blue" />
        <StatCard label="Stock total" value={totalStock.toLocaleString('es-NI')} hint="Unidades base" icon={<Package />} accent="sky" />
        <StatCard label="Valor total" value={formatMoneyStat(totalValue, rate)} hint="A costo" icon={<Calculator />} accent="emerald" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar artículo o código…" className="w-full lg:max-w-xs" />
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
          <div className="ml-auto text-[11px] text-muted-foreground">{rows.length} artículos</div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<Package />} title="Sin artículos" description="No hay artículos con stock físico." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Artículo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Costo unit.</TableHead>
                <TableHead className="text-right">Valor total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="num text-[11px]">{p.sku}</TableCell>
                  <TableCell className="text-xs font-medium">{p.name}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{p.category}</TableCell>
                  <TableCell className="num text-right text-xs">{p.stock}</TableCell>
                  <TableCell className="num text-right text-xs">{formatMoney(p.cost, rate)}</TableCell>
                  <TableCell className="num text-right text-xs font-semibold">{formatMoney(p.value, rate)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40">
                <TableCell colSpan={5} className="text-xs font-semibold">
                  Total general
                </TableCell>
                <TableCell className="num text-right text-xs font-bold">{formatMoney(totalValue, rate)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}