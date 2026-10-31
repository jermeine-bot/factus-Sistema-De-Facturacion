import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { useSalesStore } from '@/store/useSalesStore';
import { usePurchaseStore } from '@/store/usePurchaseStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { SearchInput } from '@/components/shared/search-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber } from '@/utils/format';
import { getUnit } from '@/utils/product';

interface Row {
  date: string;
  productName: string;
  sku: string;
  type: string;
  reference: string;
  entry: number;
  exit: number;
  resulting: number;
  responsible: string;
}

export default function KardexPage(): React.JSX.Element {
  const sales = useSalesStore((state) => state.sales);
  const purchases = usePurchaseStore((state) => state.purchases);
  const adjustments = useInventoryStore((state) => state.adjustments);
  const products = useCatalogStore((state) => state.products);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];

    for (const purchase of purchases) {
      if (purchase.voided) continue;
      for (const line of purchase.items) {
        const product = products.find((p) => p.id === line.productId);
        const unit = product ? getUnit(product, line.unitId) : { ratio: 1 };
        result.push({
          date: purchase.createdAt,
          productName: line.name,
          sku: product?.sku ?? '—',
          type: 'Compra',
          reference: purchase.number,
          entry: line.quantity * (unit.ratio || 1),
          exit: 0,
          resulting: product?.stock ?? 0,
          responsible: purchase.userName,
        });
      }
    }

    for (const sale of sales) {
      if (sale.status === 'void') continue;
      for (const item of sale.items) {
        const product = products.find((p) => p.id === item.productId);
        result.push({
          date: sale.createdAt,
          productName: item.name,
          sku: product?.sku ?? '—',
          type: 'Venta',
          reference: sale.invoiceNumber,
          entry: 0,
          exit: item.quantity * (item.unitRatio || 1),
          resulting: product?.stock ?? 0,
          responsible: sale.userName,
        });
      }
    }

    for (const adj of adjustments) {
      const product = products.find((p) => p.id === adj.productId);
      result.push({
        date: adj.createdAt,
        productName: adj.productName,
        sku: product?.sku ?? '—',
        type: 'Ajuste',
        reference: adj.id,
        entry: adj.difference > 0 ? adj.difference : 0,
        exit: adj.difference < 0 ? Math.abs(adj.difference) : 0,
        resulting: adj.newStock,
        responsible: adj.issuer,
      });
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, purchases, adjustments, products]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (productFilter !== 'all' && r.sku !== productFilter) return false;
      if (term && !`${r.productName} ${r.sku} ${r.type} ${r.reference}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, search, productFilter]);

  const productOptions = useMemo(
    () => ['all', ...Array.from(new Set(products.map((p) => p.sku)))],
    [products],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administración"
        title="Kardex"
        description="Movimientos de inventario: compras, ventas y ajustes, con existencia resultante."
        icon={<Activity className="h-5 w-5" />}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-2.5 border-b border-border p-3.5 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar movimiento…" className="w-full lg:max-w-xs" />
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-muted/40 px-2.5 text-[11px]"
          >
            <option value="all">Todos los artículos</option>
            {productOptions
              .filter((s) => s !== 'all')
              .map((sku) => (
                <option key={sku} value={sku}>
                  {sku}
                </option>
              ))}
          </select>
          <div className="ml-auto text-[11px] text-muted-foreground">{filtered.length} movimientos</div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Activity />} title="Sin movimientos" description="No hay movimientos de inventario." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Artículo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead className="text-right">Entrada</TableHead>
                <TableHead className="text-right">Salida</TableHead>
                <TableHead className="text-right">Existencia</TableHead>
                <TableHead>Responsable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-[11px] text-muted-foreground">{new Date(r.date).toLocaleString('es-NI')}</TableCell>
                  <TableCell className="text-xs font-medium">{r.productName}</TableCell>
                  <TableCell className="text-[11px]">{r.type}</TableCell>
                  <TableCell className="num text-[11px]">{r.reference}</TableCell>
                  <TableCell className="num text-right text-xs text-success">{r.entry > 0 ? formatNumber(r.entry) : '—'}</TableCell>
                  <TableCell className="num text-right text-xs text-destructive">{r.exit > 0 ? formatNumber(r.exit) : '—'}</TableCell>
                  <TableCell className="num text-right text-xs font-semibold">{formatNumber(r.resulting)}</TableCell>
                  <TableCell className="text-[11px]">{r.responsible}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}