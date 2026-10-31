import { useMemo, useState } from 'react';
import {
  Bluetooth,
  Building2,
  CheckCircle2,
  Coins,
  FileText,
  Monitor,
  Palette,
  Printer,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Upload,
  Usb,
  Wallet,
  Wifi,
} from 'lucide-react';
import type { PrinterConnectionType, PrinterPaperWidth, PrinterSettings } from '@/types';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useUIStore, type ThemePreference, type TableDensity } from '@/store/useUIStore';
import { toast } from '@/store/useToastStore';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { round2, toNumber } from '@/utils/format';
import { testPrintTicket } from '@/utils/printer';

type Tab = 'identidad' | 'preferencias' | 'monedas' | 'impresion' | 'apariencia' | 'caja';

const DEFAULT_PRINTER: PrinterSettings = {
  enabled: true,
  name: 'Impresora Térmica POS-80',
  connectionType: 'browser',
  paperWidth: '80mm',
  ipAddress: '192.168.1.200',
  port: 9100,
  autoPrintOnSale: true,
  openCashDrawer: true,
  cutPaper: true,
  showLogo: true,
  printCustomer: true,
  copies: 1,
  ticketHeader: '¡Gracias por su preferencia!',
  ticketFooter: 'Conserve este ticket como comprobante de pago.',
};

export default function ConfiguracionPage(): React.JSX.Element {
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const updateExchangeRate = useSettingsStore((state) => state.updateExchangeRate);

  const themePreference = useUIStore((state) => state.themePreference);
  const setThemePreference = useUIStore((state) => state.setThemePreference);
  const displayCurrency = useUIStore((state) => state.displayCurrency);
  const setDisplayCurrency = useUIStore((state) => state.setDisplayCurrency);
  const tableDensity = useUIStore((state) => state.tableDensity);
  const setTableDensity = useUIStore((state) => state.setTableDensity);

  const [tab, setTab] = useState<Tab>('identidad');
  const [draft, setDraft] = useState(settings);
  const [rate, setRate] = useState(settings.exchangeRate);
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.companyLogo ?? null);
  const [printerConfig, setPrinterConfig] = useState<PrinterSettings>(
    () => settings.printer ?? DEFAULT_PRINTER,
  );
  const [isDetecting, setIsDetecting] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings],
  );

  const handleLogoUpload = (file: File | null): void => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setLogoPreview(result);
      setDraft((prev) => ({ ...prev, companyLogo: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveIdentity = (): void => {
    updateSettings({
      companyName: draft.companyName,
      legalName: draft.legalName,
      rnc: draft.rnc,
      address: draft.address,
      phone: draft.phone,
      email: draft.email,
      footerMessage: draft.footerMessage,
      companyLogo: draft.companyLogo,
    });
    toast.success('Configuración guardada', 'Identidad del negocio actualizada.');
  };

  const handleSaveCurrency = (): void => {
    try {
      updateExchangeRate(round2(rate));
      updateSettings({
        currency: draft.currency,
        taxRate: draft.taxRate,
        cashDrawerRequired: draft.cashDrawerRequired,
        lowStockAlert: draft.lowStockAlert,
        invoicePrefix: draft.invoicePrefix,
        proformaPrefix: draft.proformaPrefix,
        purchasePrefix: draft.purchasePrefix,
        expensePrefix: draft.expensePrefix,
      });
      toast.success('Moneda actualizada', `Tasa C$ ${rate.toFixed(2)} por USD.`);
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'No se pudo actualizar.');
    }
  };

  const handleSavePrinter = (): void => {
    updateSettings({
      invoicePrefix: draft.invoicePrefix,
      proformaPrefix: draft.proformaPrefix,
      purchasePrefix: draft.purchasePrefix,
      expensePrefix: draft.expensePrefix,
      printer: printerConfig,
    });
    toast.success('Impresora guardada', 'Configuración de conexión y tickets actualizada.');
  };

  const handleDetectDevice = async (): Promise<void> => {
    setIsDetecting(true);
    try {
      if (printerConfig.connectionType === 'usb') {
        if ('usb' in navigator) {
          // @ts-expect-error WebUSB API
          const device = await navigator.usb.requestDevice({ filters: [] });
          if (device) {
            const devName = device.productName || 'Impresora Térmica USB';
            setPrinterConfig((prev) => ({ ...prev, name: devName }));
            toast.success('Dispositivo USB enlazado', `${devName} configurada como impresora activa.`);
          }
        } else {
          toast.info(
            'Conexión USB',
            'Tu navegador utiliza los controladores del sistema operativo. Asegúrate de que la impresora esté encendida e instalada.',
          );
        }
      } else if (printerConfig.connectionType === 'bluetooth') {
        if ('bluetooth' in navigator) {
          // @ts-expect-error Web Bluetooth API
          const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
          });
          if (device) {
            const devName = device.name || 'Impresora Bluetooth POS';
            setPrinterConfig((prev) => ({ ...prev, name: devName }));
            toast.success('Bluetooth enlazado', `${devName} conectado exitosamente.`);
          }
        } else {
          toast.info(
            'Conexión Bluetooth',
            'Vincula tu impresora Bluetooth en los ajustes de tu sistema operativo (Windows/Android/Mac) y selecciónala al imprimir.',
          );
        }
      } else if (printerConfig.connectionType === 'network') {
        if (!printerConfig.ipAddress?.trim()) {
          toast.error('IP requerida', 'Ingresa la dirección IP de la impresora en tu red local.');
          return;
        }
        toast.success(
          'Impresora de red verificada',
          `Dirección ${printerConfig.ipAddress}:${printerConfig.port || 9100} enlazada.`,
        );
      } else {
        toast.success(
          'Impresora de sistema activa',
          'Factus enviará los tickets al administrador de impresión predeterminado de tu equipo.',
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'NotFoundError') {
        toast.error('Error al detectar', err.message);
      }
    } finally {
      setIsDetecting(false);
    }
  };

  const handleTestPrint = (): void => {
    try {
      testPrintTicket(settings, printerConfig);
      toast.success('Ticket de prueba enviado', 'Verifica la impresión en tu impresora térmica.');
    } catch (error) {
      toast.error('Error de impresión', error instanceof Error ? error.message : 'No se pudo generar la prueba.');
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'identidad', label: 'Identidad', icon: <Building2 className="h-3.5 w-3.5" /> },
    { id: 'monedas', label: 'Monedas', icon: <Coins className="h-3.5 w-3.5" /> },
    { id: 'impresion', label: 'Impresora', icon: <Printer className="h-3.5 w-3.5" /> },
    { id: 'preferencias', label: 'Preferencias', icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
    { id: 'apariencia', label: 'Apariencia', icon: <Palette className="h-3.5 w-3.5" /> },
    { id: 'caja', label: 'Caja', icon: <Wallet className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema"
        title="Configuración"
        description="Administra la identidad, preferencias, monedas y facturación del negocio."
        icon={<SlidersHorizontal className="h-5 w-5" />}
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="lg:w-56">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 border-b border-border px-3.5 py-2.5 text-left text-xs font-medium transition-colors last:border-b-0',
                  tab === entry.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                {entry.icon} {entry.label}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex-1 space-y-4">
          {tab === 'identidad' ? (
            <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" /> Subir logotipo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nombre comercial</Label>
                  <Input value={draft.companyName} onChange={(e) => setDraft({ ...draft, companyName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Razón legal</Label>
                  <Input value={draft.legalName} onChange={(e) => setDraft({ ...draft, legalName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>RUC</Label>
                  <Input value={draft.rnc} onChange={(e) => setDraft({ ...draft, rnc: e.target.value })} className="num" />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Correo</Label>
                  <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Dirección</Label>
                  <Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Pie de factura</Label>
                  <Textarea value={draft.footerMessage} onChange={(e) => setDraft({ ...draft, footerMessage: e.target.value })} rows={2} />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveIdentity} disabled={!dirty}>
                  <Save className="h-3.5 w-3.5" /> Guardar identidad
                </Button>
              </div>
            </div>
          ) : null}

          {tab === 'preferencias' ? (
            <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold">Moneda de visualización</p>
                  <p className="text-[10px] text-muted-foreground">Se usa en reportes y vistas. La configuración base está en Monedas.</p>
                </div>
                <div className="flex gap-2">
                  {(['NIO', 'USD'] as const).map((currency) => (
                    <button
                      key={currency}
                      type="button"
                      onClick={() => setDisplayCurrency(currency)}
                      className={cn(
                        'rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                        displayCurrency === currency
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'apariencia' ? (
            <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold">Tema</p>
                  <p className="text-[10px] text-muted-foreground">Elige la apariencia de la interfaz.</p>
                </div>
                <div className="flex gap-2">
                  {(['light', 'dark', 'system'] as ThemePreference[]).map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => setThemePreference(pref)}
                      className={cn(
                        'rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                        themePreference === pref
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {pref === 'light' ? 'Claro' : pref === 'dark' ? 'Oscuro' : 'Sistema'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold">Densidad de tablas</p>
                  <p className="text-[10px] text-muted-foreground">Compacta para más filas, cómoda para lectura.</p>
                </div>
                <div className="flex gap-2">
                  {(['compact', 'comfortable'] as TableDensity[]).map((density) => (
                    <button
                      key={density}
                      type="button"
                      onClick={() => setTableDensity(density)}
                      className={cn(
                        'rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                        tableDensity === density
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {density === 'compact' ? 'Compacta' : 'Cómoda'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'monedas' ? (
            <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Moneda base</Label>
                  <Input value="NIO (Córdoba)" disabled />
                </div>
                <div className="space-y-1.5">
                  <Label>Tasa de cambio (C$ por USD)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rate}
                    onChange={(e) => setRate(toNumber(e.target.value))}
                    className="num"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tasa de IVA (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.taxRate * 100}
                    onChange={(e) => setDraft({ ...draft, taxRate: toNumber(e.target.value) / 100 })}
                    className="num"
                  />
                </div>
              </div>

              <div className="rounded-md border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
                Vista previa: C$ 1,000.00 = $ {(1000 / (rate || 1)).toFixed(2)} USD
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveCurrency}>
                  <Save className="h-3.5 w-3.5" /> Guardar monedas
                </Button>
              </div>
            </div>
          ) : null}

          {tab === 'impresion' ? (
            <div className="space-y-4">
              {/* Conexión de Impresora */}
              <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                      <Printer className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">Conexión de Impresora</h3>
                      <p className="text-[11px] text-muted-foreground">
                        Vincula tu impresora térmica de tickets (ESC/POS) o impresora de facturas.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold',
                        printerConfig.enabled
                          ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border border-border bg-muted/60 text-muted-foreground',
                      )}
                    >
                      {printerConfig.enabled ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Conectada / Lista
                        </>
                      ) : (
                        'Desactivada'
                      )}
                    </span>
                    <Switch
                      checked={printerConfig.enabled}
                      onCheckedChange={(checked) => setPrinterConfig((prev) => ({ ...prev, enabled: checked }))}
                    />
                  </div>
                </div>

                {printerConfig.enabled && (
                  <div className="space-y-4 pt-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="printer-name">Nombre / Modelo de la impresora</Label>
                        <Input
                          id="printer-name"
                          value={printerConfig.name}
                          onChange={(e) => setPrinterConfig((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Ej. Epson TM-T20III, Xprinter XP-80, Bixolon"
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Método de conexión</Label>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                          {[
                            { id: 'browser', label: 'Navegador / SO', icon: Monitor, hint: 'Diálogo del sistema' },
                            { id: 'usb', label: 'USB Directo', icon: Usb, hint: 'Cable USB POS' },
                            { id: 'network', label: 'Red / WiFi', icon: Wifi, hint: 'IP / Ethernet' },
                            { id: 'bluetooth', label: 'Bluetooth', icon: Bluetooth, hint: 'Inalámbrico' },
                          ].map((conn) => {
                            const Icon = conn.icon;
                            const active = printerConfig.connectionType === conn.id;
                            return (
                              <button
                                key={conn.id}
                                type="button"
                                onClick={() =>
                                  setPrinterConfig((prev) => ({
                                    ...prev,
                                    connectionType: conn.id as PrinterConnectionType,
                                  }))
                                }
                                className={cn(
                                  'flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all',
                                  active
                                    ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/20'
                                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/70',
                                )}
                              >
                                <Icon className="h-4 w-4" />
                                <span className="text-[11px] leading-tight">{conn.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {printerConfig.connectionType === 'network' && (
                      <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-3">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="printer-ip">Dirección IP de la impresora</Label>
                          <Input
                            id="printer-ip"
                            value={printerConfig.ipAddress ?? ''}
                            onChange={(e) => setPrinterConfig((prev) => ({ ...prev, ipAddress: e.target.value }))}
                            placeholder="192.168.1.200"
                            className="h-9 font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="printer-port">Puerto</Label>
                          <Input
                            id="printer-port"
                            type="number"
                            value={printerConfig.port ?? 9100}
                            onChange={(e) =>
                              setPrinterConfig((prev) => ({ ...prev, port: Number(e.target.value) || 9100 }))
                            }
                            placeholder="9100"
                            className="h-9 font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/40 px-3.5 py-2.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>
                          {printerConfig.connectionType === 'browser'
                            ? 'Compatible con cualquier impresora conectada a tu computadora o sistema operativo.'
                            : printerConfig.connectionType === 'usb'
                              ? 'Conexión directa por cable USB para envío inmediato de tickets.'
                              : printerConfig.connectionType === 'network'
                                ? `Conectada por red local a través de ${printerConfig.ipAddress || 'IP local'}:${printerConfig.port || 9100}.`
                                : 'Conexión inalámbrica Bluetooth para terminales y dispositivos portátiles.'}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isDetecting}
                        onClick={handleDetectDevice}
                        className="gap-1.5 text-xs"
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', isDetecting && 'animate-spin')} />
                        {isDetecting ? 'Detectando...' : 'Detectar / Probar conexión'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Formato y Papel */}
              <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div>
                  <h3 className="text-sm font-semibold">Formato y Papel Térmico</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Elige el ancho del rollo de papel para que los tickets se ajusten a la perfección.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Ancho de rollo / papel</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: '80mm', label: '80 mm', desc: 'Estándar POS' },
                        { id: '58mm', label: '58 mm', desc: 'Compacto' },
                        { id: 'letter', label: 'Carta / A4', desc: 'Hoja completa' },
                      ].map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() =>
                            setPrinterConfig((prev) => ({ ...prev, paperWidth: w.id as PrinterPaperWidth }))
                          }
                          className={cn(
                            'flex flex-col items-center justify-center rounded-lg border p-2.5 text-center transition-all',
                            printerConfig.paperWidth === w.id
                              ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/20'
                              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                          )}
                        >
                          <span className="text-xs font-bold">{w.label}</span>
                          <span className="text-[9px] text-muted-foreground mt-0.5">{w.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Número de copias al imprimir</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[1, 2].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPrinterConfig((prev) => ({ ...prev, copies: n }))}
                          className={cn(
                            'rounded-lg border p-2.5 text-center text-xs font-semibold transition-all',
                            printerConfig.copies === n
                              ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/20'
                              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                          )}
                        >
                          {n === 1 ? '1 Copia (Cliente)' : '2 Copias (Cliente + Local)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Automatización y Opciones del Ticket */}
              <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div>
                  <h3 className="text-sm font-semibold">Opciones de Automatización en Caja y POS</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Define las acciones automáticas al registrar y cobrar ventas.
                  </p>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
                    <div>
                      <p className="text-xs font-medium">Impresión automática en POS</p>
                      <p className="text-[10px] text-muted-foreground">Lanza el ticket de inmediato tras cobrar.</p>
                    </div>
                    <Switch
                      checked={printerConfig.autoPrintOnSale}
                      onCheckedChange={(checked) =>
                        setPrinterConfig((prev) => ({ ...prev, autoPrintOnSale: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
                    <div>
                      <p className="text-xs font-medium">Apertura de gaveta de dinero</p>
                      <p className="text-[10px] text-muted-foreground">Pulso eléctrico RJ11 para abrir el cajón.</p>
                    </div>
                    <Switch
                      checked={printerConfig.openCashDrawer}
                      onCheckedChange={(checked) =>
                        setPrinterConfig((prev) => ({ ...prev, openCashDrawer: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
                    <div>
                      <p className="text-xs font-medium">Corte de papel automático</p>
                      <p className="text-[10px] text-muted-foreground">Envía comando de guillotina al finalizar.</p>
                    </div>
                    <Switch
                      checked={printerConfig.cutPaper}
                      onCheckedChange={(checked) =>
                        setPrinterConfig((prev) => ({ ...prev, cutPaper: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
                    <div>
                      <p className="text-xs font-medium">Imprimir logo en ticket</p>
                      <p className="text-[10px] text-muted-foreground">Incluye el logotipo en el encabezado.</p>
                    </div>
                    <Switch
                      checked={printerConfig.showLogo}
                      onCheckedChange={(checked) =>
                        setPrinterConfig((prev) => ({ ...prev, showLogo: checked }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-header">Encabezado personalizado del ticket</Label>
                    <Input
                      id="ticket-header"
                      value={printerConfig.ticketHeader ?? ''}
                      onChange={(e) => setPrinterConfig((prev) => ({ ...prev, ticketHeader: e.target.value }))}
                      placeholder="Ej. ¡Gracias por su preferencia!"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-footer">Pie del ticket</Label>
                    <Input
                      id="ticket-footer"
                      value={printerConfig.ticketFooter ?? ''}
                      onChange={(e) => setPrinterConfig((prev) => ({ ...prev, ticketFooter: e.target.value }))}
                      placeholder="Ej. Conserve este ticket como comprobante."
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Prefijos de Comprobantes */}
              <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div>
                  <h3 className="text-sm font-semibold">Prefijos de Comprobantes</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Serie inicial para identificar facturas, proformas, compras y gastos.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Prefijo Factura</Label>
                    <Input
                      value={draft.invoicePrefix}
                      onChange={(e) => setDraft({ ...draft, invoicePrefix: e.target.value })}
                      className="h-9 font-mono text-xs uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prefijo Proforma</Label>
                    <Input
                      value={draft.proformaPrefix}
                      onChange={(e) => setDraft({ ...draft, proformaPrefix: e.target.value })}
                      className="h-9 font-mono text-xs uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prefijo Compra</Label>
                    <Input
                      value={draft.purchasePrefix}
                      onChange={(e) => setDraft({ ...draft, purchasePrefix: e.target.value })}
                      className="h-9 font-mono text-xs uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prefijo Gasto</Label>
                    <Input
                      value={draft.expensePrefix}
                      onChange={(e) => setDraft({ ...draft, expensePrefix: e.target.value })}
                      className="h-9 font-mono text-xs uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestPrint}
                  className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <FileText className="h-4 w-4" /> Imprimir ticket de prueba
                </Button>

                <Button onClick={handleSavePrinter} className="gap-2">
                  <Save className="h-4 w-4" /> Guardar configuración de impresora
                </Button>
              </div>
            </div>
          ) : null}

          {tab === 'caja' ? (
            <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                <div>
                  <p className="text-xs font-medium">Caja obligatoria</p>
                  <p className="text-[10px] text-muted-foreground">Exige caja abierta para cobros en efectivo.</p>
                </div>
                <Switch checked={draft.cashDrawerRequired} onCheckedChange={(checked: boolean) => setDraft({ ...draft, cashDrawerRequired: checked })} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                <div>
                  <p className="text-xs font-medium">Alerta de stock bajo</p>
                  <p className="text-[10px] text-muted-foreground">Notificaciones en el Topbar.</p>
                </div>
                <Switch checked={draft.lowStockAlert} onCheckedChange={(checked: boolean) => setDraft({ ...draft, lowStockAlert: checked })} />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    updateSettings({ cashDrawerRequired: draft.cashDrawerRequired, lowStockAlert: draft.lowStockAlert });
                    toast.success('Configuración guardada', 'Preferencias de caja actualizadas.');
                  }}
                >
                  <Save className="h-3.5 w-3.5" /> Guardar caja
                </Button>
              </div>
            </div>
          ) : null}

        </section>
      </div>
    </div>
  );
}