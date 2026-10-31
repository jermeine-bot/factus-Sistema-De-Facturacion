import { useState } from 'react';
import { FileText, RotateCcw } from 'lucide-react';
import { useSalesStore } from '@/store/useSalesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatMoney } from '@/utils/format';

export default function ReturnsPage(): React.JSX.Element {
  const sales = useSalesStore((state) => state.sales);
  const notes = useSalesStore((state) => state.creditNotes);
  const createCreditNote = useSalesStore((state) => state.createCreditNote);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const eligible = sales.filter((sale) => sale.status === 'completed' && !notes.some((note) => note.saleId === sale.id) && `${sale.invoiceNumber} ${sale.customerName}`.toLowerCase().includes(query.toLowerCase()));
  const handleReturn = (saleId: string): void => {
    try {
      const note = createCreditNote(saleId, reasons[saleId] ?? '');
      toast.success(`Nota ${note.number} emitida`, 'Inventario, crédito y caja actualizados según los pagos de la factura.');
      setReasons((state) => ({ ...state, [saleId]: '' }));
    } catch (error) {
      toast.error('No se pudo emitir la nota', error instanceof Error ? error.message : undefined);
    }
  };
  return <div className="space-y-5">
    <PageHeader eyebrow="Comercial" title="Devoluciones y notas de crédito" description="Registra devoluciones completas vinculadas a una factura y deja cada movimiento auditado." icon={<RotateCcw className="h-5 w-5" />} actions={<Badge variant="secondary">{notes.length} notas emitidas</Badge>} />
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Facturas disponibles</h2>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por factura o cliente…" className="mb-3 max-w-md" />
      {eligible.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No hay facturas disponibles para devolver.</p> : <div className="space-y-3">{eligible.map((sale) => <div key={sale.id} className="grid min-w-0 gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_1fr_auto] md:items-center"><div className="min-w-0"><p className="font-semibold">{sale.invoiceNumber} · {sale.customerName}</p><p className="text-xs text-muted-foreground">{formatDateTime(sale.createdAt)} · {sale.items.length} líneas · {formatMoney(sale.totals.total, rate)}</p></div><Input value={reasons[sale.id] ?? ''} onChange={(event) => setReasons((state) => ({ ...state, [sale.id]: event.target.value }))} placeholder="Motivo obligatorio" aria-label={`Motivo de ${sale.invoiceNumber}`} /><Button onClick={() => handleReturn(sale.id)}><RotateCcw className="h-4 w-4" /> Emitir nota</Button></div>)}</div>}
    </div>
    {notes.length > 0 && <div className="rounded-xl border border-border bg-card p-4"><h2 className="mb-3 text-sm font-semibold">Notas emitidas</h2><div className="space-y-2">{notes.map((note) => <div key={note.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-2 text-sm"><span><strong>{note.number}</strong> · {note.invoiceNumber} · {note.reason}<small className="block text-muted-foreground">{formatDateTime(note.createdAt)} · {note.userName}</small></span><strong>{formatMoney(note.total, rate)}</strong></div>)}</div></div>}
  </div>;
}
