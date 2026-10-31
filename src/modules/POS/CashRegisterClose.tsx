import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Coins,
  Landmark,
  Printer,
  RotateCcw,
  Save,
  ShieldCheck,
  Wallet,
  Wifi,
} from 'lucide-react';
import type { ArqueoLine, CashSession, Denomination } from '@/types';
import { useCashStore, sessionExpected } from '@/store/useCashStore';
import { useSalesStore } from '@/store/useSalesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAuditStore } from '@/store/useAuditStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { DENOMINATIONS, countDenominations } from '@/utils/math';
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  round2,
  toNumber,
} from '@/utils/format';
import { cn } from '@/lib/utils';

interface ClosedResult {
  session: CashSession;
  systemTotal: number;
  physicalTotal: number;
  difference: number;
  countedCash: number;
  posTotal: number;
  transferTotal: number;
}

const BILLS: Denomination[] = [10, 20, 50, 100, 200, 500];
const COINS: Denomination[] = [1, 5];

function DenominationCard({
  denomination,
  count,
  onChange,
}: {
  denomination: Denomination;
  count: number;
  onChange: (value: number) => void;
}): React.JSX.Element {
  const isBill = denomination >= 10;
  const Icon = isBill ? Banknote : Coins;
  return (
    <div
      className={cn(
        'rounded-lg border p-2.5 transition-colors',
        isBill
          ? 'border-primary/15 bg-primary/[0.04]'
          : 'border-warning/15 bg-warning/[0.04]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md border',
              isBill
                ? 'border-primary/20 bg-primary/10 text-primary'
                : 'border-warning/20 bg-warning/10 text-warning',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="num text-xs font-bold">{formatMoney(denomination)}</p>
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
              {isBill ? 'Billete' : 'Moneda'}
            </p>
          </div>
        </div>
        <Input
          type="number"
          min="0"
          step="1"
          value={count}
          onChange={(event) => onChange(Math.max(0, Math.floor(toNumber(event.target.value))))}
          className="num h-8 w-[62px] text-center text-[12px] font-semibold"
          aria-label={`Cantidad de ${denomination} córdobas`}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5">
        <span className="text-[8px] text-muted-foreground">Subtotal</span>
        <span className="num text-[10px] font-semibold">{formatMoney(denomination * count)}</span>
      </div>
    </div>
  );
}

export default function CashRegisterClose(): React.JSX.Element {
  const navigate = useNavigate();
  const cashSession = useCashStore((state) => state.current);
  const closeSession = useCashStore((state) => state.closeSession);
  const sales = useSalesStore((state) => state.sales);
  const settings = useSettingsStore((state) => state.settings);
  const currentUser = useSettingsStore((state) => state.currentUser);
  const addLog = useAuditStore((state) => state.addLog);

  const [counts, setCounts] = useState<Record<number, number>>({});
  const [posInput, setPosInput] = useState('');
  const [transferInput, setTransferInput] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [closedResult, setClosedResult] = useState<ClosedResult | null>(null);

  const rate = settings.exchangeRate;

  const channelSystem = useMemo(() => {
    if (!cashSession) return { pos: 0, transfer: 0 };
    const openedAt = new Date(cashSession.openedAt).getTime();
    const payments = sales
      .filter(
        (sale) =>
          sale.status === 'completed' && new Date(sale.createdAt).getTime() >= openedAt,
      )
      .flatMap((sale) => sale.payments);
    return {
      pos: round2(
        payments
          .filter((payment) => payment.method === 'card')
          .reduce((acc, payment) => acc + payment.amount, 0),
      ),
      transfer: round2(
        payments
          .filter((payment) => payment.method === 'transfer')
          .reduce((acc, payment) => acc + payment.amount, 0),
      ),
    };
  }, [cashSession, sales]);

  useEffect(() => {
    if (!cashSession) return;
    setCounts({});
    setPosInput(channelSystem.pos ? String(channelSystem.pos) : '');
    setTransferInput(channelSystem.transfer ? String(channelSystem.transfer) : '');
    setNotes('');
    setError('');
    // Seed the declared channel totals once per cash session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashSession?.id]);

  const cashExpected = cashSession ? sessionExpected(cashSession) : 0;
  const countedCash = countDenominations(counts);
  const pieces = DENOMINATIONS.reduce((acc, denomination) => acc + (counts[denomination] ?? 0), 0);
  const parsedPos = round2(toNumber(posInput));
  const parsedTransfer = round2(toNumber(transferInput));
  const physicalTotal = round2(countedCash + parsedPos + parsedTransfer);
  const systemTotal = round2(cashExpected + channelSystem.pos + channelSystem.transfer);
  const difference = round2(physicalTotal - systemTotal);
  const cashDifference = round2(countedCash - cashExpected);
  const posDifference = round2(parsedPos - channelSystem.pos);
  const transferDifference = round2(parsedTransfer - channelSystem.transfer);

  const comparison = useMemo(() => {
    if (difference > 0.009) {
      return {
        label: 'Sobrante',
        amountLabel: `+ ${formatMoney(difference, rate)}`,
        description: 'El conteo físico supera el total calculado por el sistema.',
        tone: 'emerald' as const,
        icon: <CheckCircle2 className="h-4 w-4" />,
      };
    }
    if (difference < -0.009) {
      return {
        label: 'Faltante',
        amountLabel: `- ${formatMoney(Math.abs(difference), rate)}`,
        description: 'El conteo físico es menor al total calculado por el sistema.',
        tone: 'rose' as const,
        icon: <ShieldCheck className="h-4 w-4" />,
      };
    }
    return {
      label: 'Cuadrado',
      amountLabel: formatMoney(0, rate),
      description: 'La caja coincide exactamente con el sistema.',
      tone: 'cyan' as const,
      icon: <CheckCircle2 className="h-4 w-4" />,
    };
  }, [difference, rate]);

  const toneClasses = {
    emerald: 'border-success/25 bg-success/[0.08] text-success',
    rose: 'border-destructive/25 bg-destructive/[0.08] text-destructive',
    cyan: 'border-info/25 bg-info/[0.08] text-info',
  };

  const resetCount = (): void => {
    setCounts({});
    setError('');
  };

  const handleClose = (): void => {
    if (!cashSession) return;
    setError('');
    if (pieces === 0 && parsedPos === 0 && parsedTransfer === 0) {
      setError('Registra al menos un billete, moneda o total de POS/transferencia antes de cerrar.');
      return;
    }
    setSubmitting(true);
    try {
      const arqueo: ArqueoLine[] = DENOMINATIONS.filter(
        (denomination) => (counts[denomination] ?? 0) > 0,
      ).map((denomination) => ({
        denomination,
        quantity: counts[denomination] ?? 0,
      }));
      const closed = closeSession({
        arqueo,
        counted: countedCash,
        notes: notes.trim(),
        userName: currentUser.name,
      });
      addLog({
        action: 'cash_closed',
        entity: 'Caja',
        entityId: closed.id,
        description: `Cierre de caja de ${currentUser.name}: sistema ${formatMoney(systemTotal, rate)}, físico ${formatMoney(physicalTotal, rate)}.`,
        severity: difference < -0.009 ? 'warning' : 'info',
        userId: currentUser.id,
        userName: currentUser.name,
        metadata: {
          efectivo_sistema: cashExpected,
          efectivo_contado: countedCash,
          pos_sistema: channelSystem.pos,
          pos_declarado: parsedPos,
          transferencia_sistema: channelSystem.transfer,
          transferencia_declarada: parsedTransfer,
          total_sistema: systemTotal,
          total_fisico: physicalTotal,
          diferencia: difference,
          piezas: pieces,
        },
      });
      setClosedResult({
        session: closed,
        systemTotal,
        physicalTotal,
        difference,
        countedCash,
        posTotal: parsedPos,
        transferTotal: parsedTransfer,
      });
      toast.success(
        'Cierre de caja registrado',
        difference === 0
          ? 'La caja quedó cuadrada con el sistema.'
          : `${comparison.label}: ${formatMoney(Math.abs(difference), rate)} de diferencia.`,
      );
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : 'No se pudo cerrar la caja.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cashSession && closedResult) {
    const closedTone =
      closedResult.difference > 0.009
        ? 'emerald'
        : closedResult.difference < -0.009
          ? 'rose'
          : 'cyan';
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Punto de venta"
          title="Cierre de caja completado"
          description={`Turno cerrado por ${closedResult.session.closedBy ?? currentUser.name} el ${formatDateTime(closedResult.session.closedAt ?? new Date().toISOString())}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate('/caja')}>
              <ArrowLeft className="h-3.5 w-3.5" /> Volver a caja
            </Button>
          }
        />
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold">Resumen del arqueo</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {closedResult.session.id} · {closedResult.session.notes || 'Sin observaciones'}
              </p>
            </div>
            <Badge variant={closedTone === 'emerald' ? 'success' : closedTone === 'rose' ? 'danger' : 'info'}>
              {closedResult.difference > 0.009
                ? 'Sobrante'
                : closedResult.difference < -0.009
                  ? 'Faltante'
                  : 'Cuadrado'}
            </Badge>
          </div>
          <div className={cn('mt-4 rounded-lg border p-4', toneClasses[closedTone])}>
            <p className="text-[10px] uppercase tracking-wider opacity-80">Diferencia final</p>
            <p className="num mt-1 font-display text-3xl font-bold">
              {closedResult.difference >= 0 ? '+ ' : '- '}
              {formatMoney(Math.abs(closedResult.difference), rate)}
            </p>
          </div>
          <div className="mt-4 space-y-1.5 text-[11px]">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Total sistema</span>
              <span className="num font-semibold">{formatMoney(closedResult.systemTotal, rate)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Total físico</span>
              <span className="num font-semibold">{formatMoney(closedResult.physicalTotal, rate)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Efectivo contado</span>
              <span className="num">{formatMoney(closedResult.countedCash, rate)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">POS / tarjeta</span>
              <span className="num">{formatMoney(closedResult.posTotal, rate)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Transferencias</span>
              <span className="num">{formatMoney(closedResult.transferTotal, rate)}</span>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/caja')}>
              <Wallet className="h-3.5 w-3.5" /> Ir a caja
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Imprimir arqueo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!cashSession) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Punto de venta"
          title="Cierre de caja"
          description="Arqueo visual de billetes y monedas, conciliación de POS y transferencias contra el total del sistema."
          icon={<Banknote className="h-5 w-5" />}
        />
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <EmptyState
            icon={<Wallet />}
            title="No hay una caja abierta"
            description="Abre un turno de caja para iniciar el conteo y registrar el cierre del día."
            action={
              <Button size="sm" onClick={() => navigate('/caja')}>
                <Wallet className="h-4 w-4" /> Abrir caja
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Punto de venta"
        title="Cierre de caja y arqueo"
        description="Cuenta cada denominación, declara el lote POS y las transferencias. La diferencia se recalcula en vivo."
        icon={<Banknote className="h-5 w-5" />}
        actions={
          <>
            <Badge variant="success" className="h-8 px-3">
              <Wallet className="h-3 w-3" /> Turno abierto
            </Badge>
            <Button variant="outline" size="sm" onClick={() => navigate('/caja')}>
              <ArrowLeft className="h-3.5 w-3.5" /> Volver a caja
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Efectivo esperado</p>
          <p className="num mt-1.5 font-display text-2xl font-bold">{formatMoney(cashExpected, rate)}</p>
          <p className="mt-1 text-[9px] text-muted-foreground">
            Apertura {formatMoney(cashSession.initialAmount, rate)} · {cashSession.movements.length} movimientos
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total sistema</p>
          <p className="num mt-1.5 font-display text-2xl font-bold text-primary">{formatMoney(systemTotal, rate)}</p>
          <p className="mt-1 text-[9px] text-muted-foreground">Efectivo + POS + transferencias</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Conteo físico</p>
          <p className="num mt-1.5 font-display text-2xl font-bold">{formatMoney(physicalTotal, rate)}</p>
          <p className="mt-1 text-[9px] text-muted-foreground">{formatNumber(pieces)} piezas contadas</p>
        </div>
        <div className={cn('rounded-lg border p-4 shadow-sm', toneClasses[comparison.tone])}>
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
            {comparison.icon} {comparison.label}
          </p>
          <p className="num mt-1.5 font-display text-2xl font-bold">{comparison.amountLabel}</p>
          <p className="mt-1 text-[9px] opacity-75">Físico vs. sistema</p>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Coins className="h-4 w-4 text-warning" /> Conteo visual de denominaciones
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Ingresa la cantidad de billetes y monedas. El subtotal y el total se actualizan al instante.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Efectivo contado</p>
                <p className="num text-sm font-bold text-warning">{formatMoney(countedCash, rate)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={resetCount}>
                <RotateCcw className="h-3 w-3" /> Limpiar
              </Button>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Banknote className="h-3.5 w-3.5 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Billetes</p>
                <span className="h-px flex-1 bg-muted/40" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3">
                {BILLS.map((denomination) => (
                  <DenominationCard
                    key={denomination}
                    denomination={denomination}
                    count={counts[denomination] ?? 0}
                    onChange={(value) =>
                      setCounts((state) => ({ ...state, [denomination]: value }))
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Coins className="h-3.5 w-3.5 text-warning" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Monedas</p>
                <span className="h-px flex-1 bg-muted/40" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3">
                {COINS.map((denomination) => (
                  <DenominationCard
                    key={denomination}
                    denomination={denomination}
                    count={counts[denomination] ?? 0}
                    onChange={(value) =>
                      setCounts((state) => ({ ...state, [denomination]: value }))
                    }
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Wallet className="h-3 w-3" /> {formatNumber(pieces)} piezas · {Object.values(counts).filter((count) => count > 0).length} denominaciones
              </span>
              <span className="num text-xs font-semibold">{formatMoney(countedCash, rate)}</span>
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Wifi className="h-4 w-4 text-info" /> Canales electrónicos
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Declara el cierre del POS y el total acreditado por el banco.
              </p>
            </div>
            <div className="space-y-3 p-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>Total POS / tarjeta</Label>
                  <span className="num text-[9px] text-muted-foreground">
                    Sistema {formatMoney(channelSystem.pos, rate)}
                  </span>
                </div>
                <div className="relative">
                  <Landmark className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={posInput}
                    onChange={(event) => setPosInput(event.target.value)}
                    placeholder="0.00"
                    className="num h-10 pl-9 text-right text-sm font-semibold"
                  />
                </div>
                <p className={cn('num text-right text-[9px]', Math.abs(posDifference) < 0.01 ? 'text-muted-foreground' : posDifference > 0 ? 'text-success' : 'text-destructive')}>
                  {posDifference >= 0 ? '+' : ''}{formatMoney(posDifference, rate)} vs. sistema
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>Transferencias bancarias</Label>
                  <span className="num text-[9px] text-muted-foreground">
                    Sistema {formatMoney(channelSystem.transfer, rate)}
                  </span>
                </div>
                <div className="relative">
                  <Landmark className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={transferInput}
                    onChange={(event) => setTransferInput(event.target.value)}
                    placeholder="0.00"
                    className="num h-10 pl-9 text-right text-sm font-semibold"
                  />
                </div>
                <p className={cn('num text-right text-[9px]', Math.abs(transferDifference) < 0.01 ? 'text-muted-foreground' : transferDifference > 0 ? 'text-success' : 'text-destructive')}>
                  {transferDifference >= 0 ? '+' : ''}{formatMoney(transferDifference, rate)} vs. sistema
                </p>
              </div>
            </div>
          </section>

          <section className={cn('overflow-hidden rounded-xl border shadow-sm', toneClasses[comparison.tone])}>
            <div className="border-b border-current/10 px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                {comparison.icon} {comparison.label}
              </p>
              <p className="mt-0.5 text-[10px] opacity-75">{comparison.description}</p>
            </div>
            <div className="space-y-1.5 p-4 text-[10px]">
              <div className="flex justify-between gap-3">
                <span className="opacity-75">Efectivo sistema</span>
                <span className="num font-semibold">{formatMoney(cashExpected, rate)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="opacity-75">Efectivo contado</span>
                <span className="num font-semibold">{formatMoney(countedCash, rate)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-current/10 pt-1.5">
                <span className="opacity-75">Diferencia efectivo</span>
                <span className="num font-semibold">{formatMoney(cashDifference, rate)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="opacity-75">POS declarado</span>
                <span className="num">{formatMoney(parsedPos, rate)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="opacity-75">Transferencias declaradas</span>
                <span className="num">{formatMoney(parsedTransfer, rate)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-current/10 pt-1.5">
                <span className="opacity-75">Total físico</span>
                <span className="num font-bold">{formatMoney(physicalTotal, rate)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="opacity-75">Total sistema</span>
                <span className="num font-bold">{formatMoney(systemTotal, rate)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="space-y-1.5">
              <Label>Observaciones del cierre</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Novedades del turno, faltantes, sobrantes o acuerdos…"
              />
            </div>
            {error ? (
              <p className="mt-2 rounded-md border border-destructive/20 bg-destructive/[0.08] px-3 py-2 text-[11px] text-destructive">
                {error}
              </p>
            ) : null}
            <Button className="mt-3 w-full" onClick={handleClose} loading={submitting}>
              <Save className="h-4 w-4" /> Cerrar caja y guardar arqueo
            </Button>
            <p className="mt-2 flex items-center justify-center gap-1 text-[9px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> El cierre es definitivo y queda en auditoría.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
