import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Error inesperado en la interfaz.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Factus UI error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-xl border border-destructive/20 bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <h1 className="font-display text-lg font-semibold">Algo salió mal</h1>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{this.state.message}</p>
            <Button
              className="mt-5"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.assign('/');
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reiniciar aplicación
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
