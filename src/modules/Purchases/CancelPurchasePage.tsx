import { useMemo, useState } from 'react';
import { Search, XCircle } from 'lucide-react';
import { usePurchaseStore } from '@/store/usePurchaseStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatMoney, formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';

export default function CancelPurchasePage(): React.JSX.Element {
  const purchases = usePurchaseStore((state) => state.purchases);
  const voidPurchase = usePurchaseStore((state) => state.voidPurchase);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);

  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return purchases.filter((p) =>
      term ? `${p.number} ${p.supplierName} ${p.invoiceRef}`.toLowerCase().includes(term) : true,
    );
  }, [purchases, search]);

  const targetPurchase = purchases.find((p) => p.id === target) ?? null;

  const handleVoid = (): void => {
    if (!target) return;
    setError('');
    if (!reason.trim()) {
      setError('Indica el motivo de la anulación.');
      return;
    }
    try {
      voidPurchase(target, reason);
      toast.success('Compra anulada', targetPurchase?.number ?? '');
      setTarget(null);
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo anular.');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Compras"
        title="Anulación de facturas de compra"
        description="Busca una factura, consulta su detalle y anúlala con motivo. Se revierten inventario, cuentas por pagar y caja cuando aplique."
        icon={<XCircle className="h-5 w-5" />}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-border p-3.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, proveedor o referencia…"
            className="h-8 flex-1 bg-transparent text-xs outline-none"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<XCircle />} title="Sin facturas" description="No hay facturas de compra registradas." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="num text-[11px] font-medium">{p.number}</TableCell>
                  <TableCell className="text-xs">{p.supplierName}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                  <TableCell className="num text-right text-xs font-semibold">{formatMoney(p.total, rate)}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        p.voided ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success',
                      )}
                    >
                      {p.voided ? 'Anulada' : 'Activa'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={p.voided}
                        onClick={() => setTarget(p.id)}
                      >
                        Anular
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) { setTarget(null); setReason(''); setError(''); } }}>
        <DialogContent className="max-w-md">
          {targetPurchase ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" /> Anular compra
                </DialogTitle>
                <DialogDescription>
                  {targetPurchase.number} · {targetPurchase.supplierName} · {formatMoney(targetPurchase.total, rate)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5">
                <Label>Motivo de anulación</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Error de registro, devolución…" />
              </div>

              {targetPurchase.isCashDrawerExpense ? (
                <p className="text-[10px] text-muted-foreground">
                  Esta compra afectó la caja. La anulación registrará un depósito de reposición.
                </p>
              ) : null}

              {error ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{error}</div>
              ) : null}

              <DialogFooter>
                <Button variant="ghost" onClick={() => { setTarget(null); setReason(''); setError(''); }}>Cancelar</Button>
                <Button variant="destructive" onClick={handleVoid}>Confirmar anulación</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}