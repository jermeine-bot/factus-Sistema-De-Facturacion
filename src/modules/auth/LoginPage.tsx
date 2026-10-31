import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  CreditCard,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Brand } from '@/components/layout/sidebar';
import { initials } from '@/utils/format';
import { cn } from '@/lib/utils';

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  cashier: 'Cajero',
  warehouse: 'Bodega',
};

export default function LoginPage(): React.JSX.Element {
  const users = useSettingsStore((state) => state.users);
  const login = useSettingsStore((state) => state.login);
  const isAuthenticated = useSettingsStore((state) => state.isAuthenticated);
  const navigate = useNavigate();
  const activeUsers = users.filter((user) => user.isActive);
  const [selectedId, setSelectedId] = useState(activeUsers[0]?.id ?? '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const selected = users.find((user) => user.id === selectedId);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError('');
    if (!selected) {
      setError('Selecciona un usuario para continuar.');
      return;
    }
    if (pin !== selected.pin) {
      setError('PIN incorrecto. Verifica tu código de acceso.');
      return;
    }
    try {
      login(selected.id);
      navigate('/');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No se pudo iniciar sesión.');
    }
  };

  const quickLogin = (userId: string): void => {
    try {
      login(userId);
      navigate('/');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No se pudo iniciar sesión.');
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-mask opacity-30" />
      <div className="pointer-events-none absolute -left-40 top-1/4 h-[420px] w-[420px] rounded-full bg-blue-600/[0.06] blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-[380px] w-[380px] rounded-full bg-sky-500/[0.05] blur-[120px]" />

      <section className="relative hidden w-[52%] flex-col justify-between border-r border-border p-10 lg:flex xl:p-14">
        <Brand />

        <div className="max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600 shadow-sm dark:text-blue-400">
            <Sparkles className="h-3 w-3" /> Enterprise POS · ERP
          </div>
          <h1 className="font-display text-[44px] font-extrabold leading-[1.08] tracking-tight xl:text-[54px]">
            El sistema operativo de tu <span className="text-gradient">comercio</span>.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            Punto de venta multi-divisa, inventario con conversiones inteligentes, control de
            crédito y arqueo de caja en una sola plataforma de alto rendimiento.
          </p>

          <div className="mt-9 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {[
              {
                icon: CreditCard,
                title: 'Cobro multi-divisa',
                text: 'C$ / USD, pagos divididos y vueltos exactos.',
              },
              {
                icon: Boxes,
                title: 'Stock inteligente',
                text: 'Combos y presentaciones con deducción en cascada.',
              },
              {
                icon: ShieldCheck,
                title: 'Crédito controlado',
                text: 'Bloqueo automático al superar el límite.',
              },
              {
                icon: Zap,
                title: 'Caja auditable',
                text: 'Arqueo por denominación con sobrantes y faltantes.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-muted/40 dark:hover:border-slate-700"
              >
                <feature.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="mt-2.5 text-xs font-semibold">{feature.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-success" /> React + TypeScript
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-success" /> Servicios REST tipados
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-success" /> Listo para API
          </span>
        </div>
      </section>

      <section className="relative flex flex-1 items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <Brand />
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-xl sm:p-7">
            <div className="mb-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
                <Fingerprint className="h-5 w-5" />
              </div>
              <h2 className="font-display text-xl font-bold tracking-tight">Acceso al sistema</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Selecciona tu perfil operativo e ingresa tu PIN de seguridad.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Perfil de acceso</Label>
                <div className="grid grid-cols-2 gap-2">
                  {activeUsers.slice(0, 4).map((user) => {
                    const active = user.id === selectedId;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(user.id);
                          setPin('');
                          setError('');
                        }}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md border p-2.5 text-left transition-all',
                          active
                            ? 'border-blue-500 bg-blue-50 shadow-sm dark:border-blue-500/50 dark:bg-blue-500/10'
                            : 'border-border bg-card hover:border-slate-300 hover:bg-muted/50 dark:hover:border-slate-600',
                        )}
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-white/15"
                          style={{ backgroundColor: user.avatarColor }}
                        >
                          {initials(user.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-semibold">{user.name}</span>
                          <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">
                            {roleLabel[user.role] ?? user.role}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pin">PIN de seguridad</Label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selected) setPin(selected.pin);
                    }}
                    className="text-[10px] font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Usar PIN de prueba
                  </button>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="pl-9 tracking-[0.4em]"
                    autoComplete="current-password"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/60">
                  Acceso inicial · admin@factus.ni · PIN 1234
                </p>
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="h-11 w-full" disabled={!selected}>
                Iniciar sesión <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-muted/40" />
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">o acceso rápido</span>
              <div className="h-px flex-1 bg-muted/40" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {activeUsers.slice(0, 2).map((user) => (
                <Button
                  key={user.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => quickLogin(user.id)}
                >
                  Entrar como {roleLabel[user.role] ?? user.role}
                </Button>
              ))}
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-4 w-full text-center text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Volver a la sesión activa
              </button>
            ) : null}
          </div>

          <p className="mt-5 text-center text-[10px] leading-relaxed text-muted-foreground/40">
            Autenticación local provisional · Se reemplazará al conectar el backend.
            <br />
            Factus © 2026
          </p>
        </div>
      </section>
    </div>
  );
}
