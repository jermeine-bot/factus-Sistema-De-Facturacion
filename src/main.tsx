import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import '@/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el nodo raíz de la aplicación.');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <TooltipProvider delayDuration={250}>
        <App />
        <Toaster />
      </TooltipProvider>
    </BrowserRouter>
  </StrictMode>,
);
