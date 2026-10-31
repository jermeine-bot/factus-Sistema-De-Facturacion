import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CircleDot,
  Coins,
  History,
  Lock,
  Plus,
  ReceiptText,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { ArqueoLine, CashMovement, CashSession, Denomination, MovementType } from '@/types';
import { useCashStore, sessionExpected } from '@/store/useCashStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAuditStore } from '@/store/useAuditStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DENOMINATIONS, countDenominations } from '@/utils/math';
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  formatTime,
  round2,
} from '@/utils/format';
import { cn } from '@/lib/utils';

const movementMeta: Record<MovementType, { label: string; tone: string; icon: typeof Banknote }> = {
  sale: { label: 'Venta', tone: 'text-success', icon: ArrowDownLeft },
  expense: { label: 'Gasto', tone: 'text-destructive', icon: ArrowUpRight },
  purchase: { label: 'Compra', tone: 'text-destructive', icon: ArrowUpRight },
  withdrawal: { label: 'Retiro', tone: 'text-destructive', icon: TrendingDown },
  deposit: { label: 'Depósito', tone: 'text-success', icon: TrendingUp },
  credit_payment: { label: 'Abono', tone: 'text-info', icon: ArrowDownLeft },
  opening: { label: 'Apertura', tone: 'text-primary', icon: Wallet },
};

export default function CashPage(): React.JSX.Element {
  const session = useCashStore((state) => state.current);
  const history = useCashStore((state) => state.history);
  const openSession = useCashStore((state) => state.openSession);
  const closeSession = useCashStore((state) => state.closeSession);
  const addMovement = useCashStore((state) => state.addMovement);
  const user = useSettingsStore((state) => state.currentUser);
  const rate = useSettingsStore((state) => state.settings.exchangeRate);
  const addLog = useAuditStore((state) => state.addLog);

  const [counts, setCounts] = useState<Record<number, string>>({});
  const [closeNotes, setCloseNotes] = useState('');
  const [openAmount, setOpenAmount] = useState('2500');
  const [openNotes, setOpenNotes] = useState('Turno de caja principal.');
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementConcept, setMovementConcept] = useState('');
  const [movementError, setMovementError] = useState('');
  const [detailSession, setDetailSession] = useState<CashSession | null>(null);
  const [closedResult, setClosedResult] = useState<CashSession | null>(null);
  const [closeError, setCloseError] = useState('');

  const expected = session ? sessionExpected(session) : 0;
  const movementTotals = useMemo(() => {
    if (!session) return { inflow: 0, outflow: 0, sales: 0, expenses: 0 };
    return session.movements.reduce(
      (acc, movement) => {
        if (movement.amount > 0) acc.inflow += movement.amount;
        else acc.outflow += Math.abs(movement.amount);
        if (movement.type === 'sale') acc.sales += movement.amount;
        if (movement.type === 'expense' || movement.type === 'purchase') acc.expenses += Math.abs(movement.amount);
        return acc;
      },
      { inflow: 0, outflow: 0, sales: 0, expenses: 0 },
    );
  }, [session]);

  const countedMap = useMemo(() => {
    const map: Record<number, number> = {};
    for (const [key, value] of Object.entries(counts)) {
      map[Number(key)] = Math.max(0, Number(value) || 0);
    }
    return map;
  }, [counts]);
  const counted = countDenominations(countedMap);
  const difference = round2(counted - expected);
  const hasCount = DENOMINATIONS.some((denomination) => (countedMap[denomination] ?? 0) > 0);
  const lastClosed = history[0];

  useEffect(() => {
    setCounts({});
    setCloseNotes('');
    setCloseError('');
  }, [session?.id]);

  const handleOpen = (): void => {
    try {
      const amount = Number(openAmount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error('El fondo inicial debe ser válido.');
      const opened = openSession({ initialAmount: amount, notes: openNotes.trim(), userName: user.name });
      addLog({
        action: 'cash_opened',
        entity: 'Caja',
        entityId: opened.id,
        description: `Apertura de caja con fondo de ${formatMoney(amount, rate)} por ${user.name}.`,
        userId: user.id,
        userName: user.name,
        metadata: { fondo: amount },
      });
      toast.success('Caja abierta', `Fondo inicial ${formatMoney(amount, rate)}.`);
    } catch (error) {
      toast.error('No se pudo abrir la caja', error instanceof Error ? error.message : undefined);
    }
  };

  const handleClose = (): void => {
    if (!session) return;
    setCloseError('');
    try {
      const arqueo: ArqueoLine[] = DENOMINATIONS.filter((denomination) => (countedMap[denomination] ?? 0) > 0).map(
        (denomination) => ({ denomination, quantity: countedMap[denomination] ?? 0 }),
      );
      const closed = closeSession({
        arqueo,
        counted,
        notes: closeNotes.trim() || 'Cierre de turno.',
        userName: user.name,
      });
      addLog({
        action: 'cash_closed',
        entity: 'Caja',
        entityId: closed.id,
        description: `Cierre de caja: esperado ${formatMoney(closed.expectedCash ?? 0, rate)}, contado ${formatMoney(closed.countedCash ?? 0, rate)}, ${closed.difference === 0 ? 'cuadre exacto' : closed.difference && closed.difference > 0 ? `sobrante ${formatMoney(closed.difference, rate)}` : `faltante ${formatMoney(Math.abs(closed.difference ?? 0), rate)}`}.`,
        severity: closed.difference === 0 ? 'info' : 'warning',
        userId: user.id,
        userName: user.name,
        metadata: {
          esperado: closed.expectedCash ?? 0,
          contado: closed.countedCash ?? 0,
          diferencia: closed.difference ?? 0,
        },
      });
      toast.success(
        'Caja cerrada',
        closed.difference === 0
          ? 'El arqueo cuadra exactamente.'
          : `Diferencia: ${formatMoney(closed.difference ?? 0, rate)}.`,
      );
      setClosedResult(closed);
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : 'No se pudo cerrar la caja.');
    }
  };

  const handleMovement = (): void => {
    if (!session) return;
    setMovementError('');
    try {
      const amount = Number(movementAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('El monto debe ser mayor que cero.');
      if (!movementConcept.trim()) throw new Error('Describe el concepto del movimiento.');
      if (movementType === 'withdrawal' && amount > expected) {
        throw new Error('El retiro no puede superar el efectivo esperado en caja.');
      }
      addMovement({
        type: movementType,
        amount: movementType === 'deposit' ? amount : -amount,
        concept: movementConcept.trim(),
        reference: `MAN-${Date.now().toString().slice(-6)}`,
        userName: user.name,
      });
      addLog({
        action: 'cash_movement',
        entity: 'Caja',
        entityId: session.id,
        description: `${movementType === 'deposit' ? 'Depósito' : 'Retiro'} de caja por ${formatMoney(amount, rate)} · ${movementConcept.trim()}.`,
        severity: 'info',
        userId: user.id,
        userName: user.name,
        metadata: { tipo: movementType, monto: amount },
      });
      toast.success(
        movementType === 'deposit' ? 'Depósito registrado' : 'Retiro registrado',
        `${formatMoney(amount, rate)} · ${movementConcept.trim()}`,
      );
      setMovementOpen(false);
      setMovementAmount('');
      setMovementConcept('');
    } catch (error) {
      setMovementError(error instanceof Error ? error.message : 'No se pudo registrar el movimiento.');
    }
  };

  const handleDenomination = (denomination: Denomination, value: string): void => {
    setCounts((state) => ({ ...state, [denomination]: value }));
  };

  const countedQty = DENOMINATIONS.reduce((acc, denomination) => acc + (countedMap[denomination] ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control de efectivo"
        title="Caja y arqueo"
        description="Controla el efectivo del turno, registra movimientos y verifica el arqueo antes del cierre."
        icon={<Wallet className="h-5 w-5" />}
        actions={
          <>
            {session ? (
              <Button variant="outline" size="sm" onClick={() => setMovementOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Movimiento manual
              </Button>
            ) : null}
            <Badge variant={session ? 'success' : 'warning'} className="h-8 px-3">
              <CircleDot className="h-3 w-3" />
              {session ? 'Sesión abierta' : 'Caja cerrada'}
            </Badge>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Efectivo esperado"
          value={formatMoney(expected, rate)}
          hint={session ? `Fondo inicial ${formatMoney(session.initialAmount, rate)}` : 'Abre una caja para operar'}
          icon={<Wallet />}
          accent="emerald"
        />
        <StatCard
          label="Ventas en efectivo"
          value={formatMoney(movementTotals.sales, rate)}
          hint="Del turno activo"
          icon={<ArrowDownLeft />}
          accent="blue"
        />
        <StatCard
          label="Salidas de caja"
          value={formatMoney(movementTotals.expenses, rate)}
          hint="Compras y gastos con afectación"
          icon={<ArrowUpRight />}
          accent="rose"
        />
        <StatCard
          label="Último arqueo"
          value={lastClosed ? (lastClosed.difference === 0 ? 'Cuadrado' : formatMoney(lastClosed.difference ?? 0, rate)) : '—'}
          hint={lastClosed ? `Cerrado ${formatDateTime(lastClosed.closedAt ?? lastClosed.openedAt)}` : 'Sin cierres previos'}
          icon={<ShieldCheck />}
          accent={lastClosed && (lastClosed.difference ?? 0) < 0 ? 'rose' : 'blue'}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {session ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                <div>
                  <p className="flex items-center gap-2 font-display text-base font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                    </span>
                    Turno en curso
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Abierto por {session.openedBy} · {formatTime(session.openedAt)} · {session.movements.length} movimientos
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fondo inicial</p>
                  <p className="num mt-0.5 text-base font-bold">{formatMoney(session.initialAmount, rate)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-muted/20">
                <div className="p-3.5">
                  <p className="text-xs font-medium text-muted-foreground">Entradas</p>
                  <p className="num mt-1.5 text-base font-semibold text-success">+{formatMoney(movementTotals.inflow, rate)}</p>
                </div>
                <div className="p-3.5">
                  <p className="text-xs font-medium text-muted-foreground">Salidas</p>
                  <p className="num mt-1.5 text-base font-semibold text-destructive">-{formatMoney(movementTotals.outflow, rate)}</p>
                </div>
                <div className="p-3.5">
                  <p className="text-xs font-medium text-muted-foreground">Saldo esperado</p>
                  <p className="num mt-1.5 text-base font-bold">{formatMoney(expected, rate)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-[11px] font-semibold">Movimientos del turno</p>
                <Button variant="ghost" size="sm" onClick={() => setMovementOpen(true)}>
                  <Plus className="h-3 w-3" /> Registrar
                </Button>
              </div>

              {session.movements.length === 0 ? (
                <EmptyState
                  icon={<ReceiptText />}
                  title="Sin movimientos todavía"
                  description="Las ventas en efectivo, compras y gastos aparecerán aquí automáticamente."
                  className="py-10"
                />
              ) : (
                <div className="max-h-[410px] overflow-y-auto">
                  <Table className="min-w-[560px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Responsable</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...session.movements].reverse().map((movement) => {
                        const meta = movementMeta[movement.type];
                        const Icon = meta.icon;
                        return (
                          <TableRow key={movement.id}>
                            <TableCell>
                              <p className="max-w-[240px] truncate text-[11px]">{movement.concept}</p>
                              <p className="text-[9px] text-muted-foreground">{movement.reference}</p>
                            </TableCell>
                            <TableCell>
                              <span className={cn('flex items-center gap-1 text-[10px]', meta.tone)}>
                                <Icon className="h-3 w-3" /> {meta.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-[10px] text-muted-foreground">{movement.userName}</TableCell>
                            <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">
                              {formatTime(movement.createdAt)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                'num text-right text-[11px] font-semibold',
                                movement.amount > 0 ? 'text-success' : 'text-destructive',
                              )}
                            >
                              {movement.amount > 0 ? '+' : ''}
                              {formatMoney(movement.amount, rate)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={<Lock />}
                title="No hay una caja abierta"
                description="Abre una nueva sesión con fondo inicial para comenzar a registrar ventas en efectivo y movimientos."
                className="py-12"
              />
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {session ? (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
                <div>
                  <p className="flex items-center gap-2 font-display text-base font-semibold">
                    <Coins className="h-3.5 w-3.5 text-warning" /> Arqueo de caja
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Cuenta tus billetes y monedas para comparar el efectivo real.</p>
                </div>
                <Badge variant={counted > 0 ? 'warning' : 'secondary'}>
                  {countedQty} piezas
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 p-4">
                {DENOMINATIONS.map((denomination) => {
                  const quantity = Number(counts[denomination] ?? 0);
                  const subtotal = round2(denomination * quantity);
                  return (
                    <div
                      key={denomination}
                      className={cn(
                        'rounded-xl border px-3 py-3 transition-colors',
                        quantity > 0
                          ? 'border-warning/20 bg-warning/[0.04]'
                          : 'border-border bg-muted/40',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="num text-xs font-semibold text-foreground/80">
                          C$ {formatNumber(denomination, 0)}
                        </span>
                        <span className="num text-[10px] text-muted-foreground">{formatMoney(subtotal, rate)}</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={counts[denomination] ?? ''}
                        onChange={(event) => handleDenomination(denomination, event.target.value)}
                        placeholder="0"
                        className="num mt-2 h-9 w-full rounded-lg border border-border bg-background px-3 text-right text-sm focus:border-warning/40 focus:outline-none focus:ring-2 focus:ring-warning/20"
                        aria-label={`Cantidad de C$${denomination}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3 border-t border-border bg-muted/40 px-5 py-4">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Esperado en sistema</span>
                  <span className="num font-semibold">{formatMoney(expected, rate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Contado físicamente</span>
                  <span className="num text-xl font-bold">{formatMoney(counted, rate)}</span>
                </div>
                <div
                  className={cn(
                    'flex items-center justify-between rounded-md border px-2.5 py-2',
                    !hasCount
                      ? 'border-border bg-muted/40 text-muted-foreground'
                      : difference === 0
                        ? 'border-success/20 bg-success/[0.07] text-success'
                        : difference > 0
                          ? 'border-warning/20 bg-warning/[0.07] text-warning'
                          : 'border-destructive/20 bg-destructive/[0.07] text-destructive',
                  )}
                >
                  <span className="text-xs font-semibold">
                    {!hasCount ? 'Ingresa el conteo' : difference === 0 ? 'Arqueo cuadrado' : difference > 0 ? 'Sobrante' : 'Faltante'}
                  </span>
                  <span className="num text-sm font-bold">
                    {difference > 0 ? '+' : ''}
                    {formatMoney(difference, rate)}
                  </span>
                </div>

                <Textarea
                  value={closeNotes}
                  onChange={(event) => setCloseNotes(event.target.value)}
                  placeholder="Observaciones del cierre (opcional)…"
                  className="min-h-[60px] text-[11px]"
                />

                {closeError ? (
                  <p className="rounded border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">{closeError}</p>
                ) : null}

                <Button
                  className="w-full"
                  disabled={!hasCount}
                  onClick={handleClose}
                >
                  <Lock className="h-3.5 w-3.5" /> Cerrar caja y registrar arqueo
                </Button>
                <p className="text-center text-[11px] text-muted-foreground/70">
                  El cierre genera un evento de auditoría firmado por {user.name}.
                </p>
              </div>
            </>
          ) : (
            <div className="p-4">
              <p className="flex items-center gap-1.5 font-display text-sm font-semibold">
                <Wallet className="h-3.5 w-3.5 text-primary" /> Abrir nueva caja
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Define el fondo inicial de cambio. La sesión quedará vinculada a tu usuario.
              </p>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="open-amount">Fondo inicial (C$)</Label>
                  <Input
                    id="open-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={openAmount}
                    onChange={(event) => setOpenAmount(event.target.value)}
                    className="num h-11 text-lg font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="open-notes">Notas de apertura</Label>
                  <Textarea
                    id="open-notes"
                    value={openNotes}
                    onChange={(event) => setOpenNotes(event.target.value)}
                    className="min-h-[64px] text-[11px]"
                  />
                </div>
                <Button className="w-full" onClick={handleOpen}>
                  <CircleDot className="h-3.5 w-3.5" /> Abrir caja
                </Button>
                {lastClosed ? (
                  <div className="rounded-md border border-border bg-muted/40 p-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Último cierre</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-[10px]">{formatDateTime(lastClosed.closedAt ?? lastClosed.openedAt)}</p>
                      <span className={cn('num text-[10px] font-semibold', (lastClosed.difference ?? 0) < 0 ? 'text-destructive' : 'text-success')}>
                        {formatMoney(lastClosed.difference ?? 0, rate)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <p className="flex items-center gap-1.5 font-display text-sm font-semibold">
            <History className="h-3.5 w-3.5 text-muted-foreground" /> Historial de arqueos
          </p>
          <Badge variant="secondary">{history.length} cierres</Badge>
        </div>
        {history.length === 0 ? (
          <EmptyState icon={<History />} title="Sin cierres anteriores" description="Cuando cierres una caja, el arqueo quedará guardado aquí." />
        ) : (
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead>Turno</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="text-right">Fondo</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Contado</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <p className="text-[11px] font-medium">{formatDateTime(entry.openedAt)}</p>
                    <p className="text-[9px] text-muted-foreground">
                      Cierre {entry.closedAt ? formatTime(entry.closedAt) : '—'} · {entry.movements.length} mov.
                    </p>
                  </TableCell>
                  <TableCell className="text-[10px]">{entry.closedBy ?? entry.openedBy}</TableCell>
                  <TableCell className="num text-right text-[11px]">{formatMoney(entry.initialAmount, rate)}</TableCell>
                  <TableCell className="num text-right text-[11px]">{formatMoney(entry.expectedCash ?? 0, rate)}</TableCell>
                  <TableCell className="num text-right text-[11px] font-semibold">{formatMoney(entry.countedCash ?? 0, rate)}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        'num rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                        (entry.difference ?? 0) === 0
                          ? 'bg-success/10 text-success'
                          : (entry.difference ?? 0) > 0
                            ? 'bg-warning/10 text-warning'
                            : 'bg-destructive/10 text-destructive',
                      )}
                    >
                      {(entry.difference ?? 0) > 0 ? '+' : ''}
                      {formatMoney(entry.difference ?? 0, rate)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setDetailSession(entry)}>
                      Ver detalle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Movimiento manual de caja
            </DialogTitle>
            <DialogDescription>
              Registra un depósito o retiro de efectivo. Quedará auditado con tu usuario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(['deposit', 'withdrawal'] as const).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setMovementType(entry)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    movementType === entry
                      ? entry === 'deposit'
                        ? 'border-success/30 bg-success/10'
                        : 'border-destructive/30 bg-destructive/10'
                      : 'border-border bg-muted/40 hover:border-slate-300 dark:hover:border-slate-600',
                  )}
                >
                  <p className="text-[11px] font-semibold">{entry === 'deposit' ? 'Depósito' : 'Retiro'}</p>
                  <p className="mt-0.5 text-[9px] text-muted-foreground">
                    {entry === 'deposit' ? 'Ingresa efectivo a la gaveta' : 'Extrae efectivo de la gaveta'}
                  </p>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="movement-amount">Monto (C$)</Label>
              <Input
                id="movement-amount"
                type="number"
                min={0}
                step="0.01"
                value={movementAmount}
                onChange={(event) => setMovementAmount(event.target.value)}
                className="num h-11 text-lg font-semibold"
              />
              <p className="text-[9px] text-muted-foreground">Disponible en caja: {formatMoney(expected, rate)}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="movement-concept">Concepto</Label>
              <Input
                id="movement-concept"
                value={movementConcept}
                onChange={(event) => setMovementConcept(event.target.value)}
                placeholder="Ej. Retiro de seguridad, cambio de menudeo…"
              />
            </div>
            {movementError ? (
              <p className="rounded border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">{movementError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMovementOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleMovement}>Registrar movimiento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closedResult !== null} onOpenChange={(open) => { if (!open) setClosedResult(null); }}>
        <DialogContent className="max-w-md">
          {closedResult ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-success" /> Arqueo registrado
                </DialogTitle>
                <DialogDescription>
                  Cierre firmado por {closedResult.closedBy} · {formatDateTime(closedResult.closedAt ?? closedResult.openedAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Esperado</span>
                  <span className="num font-semibold">{formatMoney(closedResult.expectedCash ?? 0, rate)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Contado</span>
                  <span className="num font-semibold">{formatMoney(closedResult.countedCash ?? 0, rate)}</span>
                </div>
                <div
                  className={cn(
                    'flex items-center justify-between rounded-md border px-3 py-2.5',
                    (closedResult.difference ?? 0) === 0
                      ? 'border-success/20 bg-success/[0.07] text-success'
                      : (closedResult.difference ?? 0) > 0
                        ? 'border-warning/20 bg-warning/[0.07] text-warning'
                        : 'border-destructive/20 bg-destructive/[0.07] text-destructive',
                  )}
                >
                  <span className="text-[11px] font-medium">
                    {(closedResult.difference ?? 0) === 0 ? 'Cuadre exacto' : (closedResult.difference ?? 0) > 0 ? 'Sobrante' : 'Faltante'}
                  </span>
                  <span className="num text-lg font-bold">{formatMoney(closedResult.difference ?? 0, rate)}</span>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-2.5 text-[10px] text-muted-foreground">
                  {closedResult.notes || 'Sin observaciones.'}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setClosedResult(null)}>Entendido</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={detailSession !== null} onOpenChange={(open) => { if (!open) setDetailSession(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {detailSession ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" /> Arqueo del turno
                </DialogTitle>
                <DialogDescription>
                  {formatDateTime(detailSession.openedAt)} → {detailSession.closedAt ? formatDateTime(detailSession.closedAt) : 'en curso'} · {detailSession.closedBy ?? detailSession.openedBy}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Fondo', detailSession.initialAmount],
                  ['Esperado', detailSession.expectedCash ?? 0],
                  ['Contado', detailSession.countedCash ?? 0],
                  ['Diferencia', detailSession.difference ?? 0],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md border border-border bg-muted/40 p-2.5">
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="num mt-1 text-xs font-semibold">{formatMoney(Number(value), rate)}</p>
                  </div>
                ))}
              </div>
              {detailSession.arqueo.length > 0 ? (
                <div className="rounded-md border border-border">
                  <p className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Conteo por denominación
                  </p>
                  <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4">
                    {detailSession.arqueo.map((line) => (
                      <div key={line.denomination} className="flex items-center justify-between px-3 py-2 text-[10px]">
                        <span className="text-muted-foreground">C$ {formatNumber(line.denomination, 0)} × {line.quantity}</span>
                        <span className="num font-semibold">{formatMoney(line.denomination * line.quantity, rate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Movimientos ({detailSession.movements.length})
                </p>
                <div className="max-h-[220px] space-y-1 overflow-y-auto">
                  {detailSession.movements.map((movement: CashMovement) => (
                    <div key={movement.id} className="flex items-center justify-between rounded border border-border px-2.5 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-[10px]">{movement.concept}</p>
                        <p className="text-[9px] text-muted-foreground">{movement.userName} · {formatTime(movement.createdAt)}</p>
                      </div>
                      <span className={cn('num text-[10px] font-semibold', movement.amount >= 0 ? 'text-success' : 'text-destructive')}>
                        {formatMoney(movement.amount, rate)}
                      </span>
                    </div>
                  ))}
                  {detailSession.movements.length === 0 ? (
                    <p className="py-4 text-center text-[10px] text-muted-foreground">Sin movimientos.</p>
                  ) : null}
                </div>
              </div>
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
                {detailSession.notes}
              </p>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
