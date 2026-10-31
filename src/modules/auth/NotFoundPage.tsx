import { useNavigate } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Brand } from '@/components/layout/sidebar';

export default function NotFoundPage(): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 text-center">
      <div className="pointer-events-none absolute inset-0 grid-mask opacity-25" />
      <div className="relative mb-8">
        <Brand />
      </div>
      <p className="num relative text-[92px] font-bold leading-none text-foreground/5">404</p>
      <div className="relative -mt-8 flex h-12 w-12 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
        <Compass className="h-6 w-6" />
      </div>
      <h1 className="relative mt-5 font-display text-xl font-semibold">Ruta no encontrada</h1>
      <p className="relative mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
        La pantalla que buscas no existe o fue movida a otro módulo del sistema.
      </p>
      <Button className="relative mt-6" onClick={() => navigate('/')}>
        <Home className="h-4 w-4" /> Volver al dashboard
      </Button>
    </div>
  );
}
