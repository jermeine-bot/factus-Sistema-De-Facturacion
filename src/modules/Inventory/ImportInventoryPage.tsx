import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useCatalogStore } from '@/store/useCatalogStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ProductDraft, ProductType } from '@/types';
import { round2, toNumber } from '@/utils/format';

const TEMPLATE_HEADERS = [
  'SKU',
  'Nombre',
  'Descripción',
  'Categoría',
  'Tipo',
  'Costo',
  'Precio',
  'Stock',
  'Stock mínimo',
  'Unidad',
  'IVA (%)',
  'Código de barras',
  'Activo (SI/NO)',
];

function parseRows(sheet: XLSX.WorkSheet): ProductDraft[] {
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return json.map((row) => {
    const get = (key: string): unknown => {
      const found = Object.keys(row).find((k) => k.toLowerCase().trim() === key.toLowerCase());
      return found ? row[found] : '';
    };
    const typeRaw = String(get('Tipo') ?? '').toLowerCase().trim();
    const type: ProductType =
      typeRaw === 'floating' || typeRaw === 'integrated' || typeRaw === 'grouped' ? (typeRaw as ProductType) : 'common';
    const activeRaw = String(get('Activo (SI/NO)') ?? 'SI').toUpperCase().trim();
    return {
      name: String(get('Nombre') ?? '').trim(),
      sku: String(get('SKU') ?? '').trim(),
      description: String(get('Descripción') ?? '').trim(),
      category: String(get('Categoría') ?? '').trim() || 'General',
      type,
      cost: toNumber(get('Costo') as string | number),
      price: toNumber(get('Precio') as string | number),
      stock: toNumber(get('Stock') as string | number),
      minStock: toNumber(get('Stock mínimo') as string | number),
      unit: String(get('Unidad') ?? '').trim() || 'unidad',
      taxRate: toNumber(get('IVA (%)') as string | number) / 100,
      barcode: String(get('Código de barras') ?? '').trim() || undefined,
      isActive: activeRaw !== 'NO',
      units: [],
      components: [],
    };
  });
}

export default function ImportInventoryPage(): React.JSX.Element {
  const importProducts = useCatalogStore((state) => state.importProducts);
  const [drafts, setDrafts] = useState<ProductDraft[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  const handleFile = async (file: File | null): Promise<void> => {
    if (!file) return;
    setError('');
    setResult(null);
    setFileName(file.name);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = parseRows(sheet);
      if (parsed.length === 0) {
        setError('El archivo no contiene filas de datos.');
        setDrafts([]);
        return;
      }
      setDrafts(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
      setDrafts([]);
    }
  };

  const handleImport = (): void => {
    if (drafts.length === 0) return;
    const res = importProducts(drafts);
    setResult(res);
    if (res.created > 0) {
      toast.success('Importación completada', `${res.created} artículos creados.`);
    } else {
      toast.info('Sin cambios', 'No se crearon artículos nuevos.');
    }
  };

  const handleTemplate = (): void => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ['SKU-001', 'Producto ejemplo', 'Descripción', 'General', 'common', 10, 15, 100, 10, 'unidad', 15, '123456', 'SI']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.writeFile(wb, 'plantilla_inventario.xlsx');
  };

  const preview = useMemo(() => drafts.slice(0, 10), [drafts]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inventario"
        title="Importar inventario desde Excel"
        description="Carga un archivo .xlsx o .csv para registrar artículos en bloque. Descarga la plantilla para ver el formato esperado."
        icon={<FileSpreadsheet className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={handleTemplate}>
            <Download className="h-3.5 w-3.5" /> Descargar plantilla
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Filas detectadas" value={String(drafts.length)} hint="En el archivo" icon={<FileSpreadsheet />} accent="blue" />
        <StatCard label="Creados" value={String(result?.created ?? 0)} hint="Importados" icon={<FileSpreadsheet />} accent="emerald" />
        <StatCard label="Omitidos" value={String(result?.skipped ?? 0)} hint="Duplicados o inválidos" icon={<FileSpreadsheet />} accent="amber" />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:bg-muted/50">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {fileName ? fileName : 'Selecciona un archivo Excel o CSV'}
          </span>
          <span className="text-[11px] text-muted-foreground">.xlsx, .xls o .csv</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {error ? (
          <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{error}</div>
        ) : null}

        {drafts.length > 0 ? (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setDrafts([]); setFileName(''); setResult(null); }}>
              Limpiar
            </Button>
            <Button size="sm" onClick={handleImport}>
              <Upload className="h-3.5 w-3.5" /> Importar {drafts.length} artículos
            </Button>
          </div>
        ) : null}
      </div>

      {drafts.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-3.5 py-2.5 text-[11px] font-semibold text-muted-foreground">
            Vista previa (primeras {preview.length} de {drafts.length})
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((d, idx) => (
                <TableRow key={idx}>
                  <TableCell className="num text-[11px]">{d.sku || '—'}</TableCell>
                  <TableCell className="text-xs font-medium">{d.name}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{d.category}</TableCell>
                  <TableCell className="text-[11px]">{d.type}</TableCell>
                  <TableCell className="num text-right text-xs">{round2(d.cost).toFixed(2)}</TableCell>
                  <TableCell className="num text-right text-xs">{round2(d.price).toFixed(2)}</TableCell>
                  <TableCell className="num text-right text-xs">{d.stock}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={<FileSpreadsheet />} title="Sin archivo" description="Selecciona un archivo para ver la vista previa." />
      )}

      {result && result.errors.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold text-destructive">Avisos de importación</p>
          <ul className="space-y-1 text-[11px] text-muted-foreground">
            {result.errors.map((e, idx) => (
              <li key={idx}>• {e}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}