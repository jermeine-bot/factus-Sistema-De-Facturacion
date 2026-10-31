import type { PrinterSettings, Settings } from '@/types';

/**
 * Realiza una prueba de impresión térmica en el navegador formateada
 * según el ancho de papel (58mm u 80mm) y las opciones configuradas.
 */
export function testPrintTicket(settings: Settings, printerConfig?: PrinterSettings): void {
  const cfg: PrinterSettings = printerConfig ?? {
    enabled: true,
    name: 'Impresora Térmica POS',
    connectionType: 'browser',
    paperWidth: '80mm',
    autoPrintOnSale: true,
    openCashDrawer: true,
    cutPaper: true,
    showLogo: true,
    printCustomer: true,
    copies: 1,
    ticketHeader: '¡Gracias por su preferencia!',
    ticketFooter: 'Conserve este ticket como comprobante de pago.',
  };

  const is58mm = cfg.paperWidth === '58mm';
  const widthPx = is58mm ? '58mm' : cfg.paperWidth === 'letter' ? '100%' : '80mm';
  const maxWidth = is58mm ? '220px' : cfg.paperWidth === 'letter' ? '800px' : '300px';
  const fontSize = is58mm ? '10px' : '12px';

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-NI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('es-NI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const printWindow = window.open('', '_blank', 'width=420,height=600');
  if (!printWindow) {
    alert('Por favor permite las ventanas emergentes (pop-ups) para imprimir.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Ticket de Prueba - Factus</title>
      <style>
        @page {
          margin: 0;
          size: ${widthPx} auto;
        }
        body {
          margin: 0;
          padding: 8px 10px;
          font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
          font-size: ${fontSize};
          line-height: 1.25;
          color: #000;
          background: #fff;
          max-width: ${maxWidth};
          margin-left: auto;
          margin-right: auto;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .double-divider {
          border-top: 2px dashed #000;
          margin: 6px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        .badge {
          display: inline-block;
          border: 1px solid #000;
          padding: 2px 6px;
          font-weight: bold;
          font-size: 11px;
          margin: 4px 0;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin: 4px 0;
        }
        .table th, .table td {
          font-size: ${fontSize};
          padding: 2px 0;
        }
        .cut-space {
          height: 35px;
        }
        @media print {
          body {
            max-width: 100%;
            padding: 2mm 3mm;
          }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="center">
        ${cfg.showLogo && settings.companyLogo ? `<img src="${settings.companyLogo}" style="max-height: 48px; max-width: 100%; margin-bottom: 4px;" alt="Logo" />` : ''}
        <div class="bold" style="font-size: 14px;">${settings.companyName || 'FACTUS'}</div>
        <div>${settings.legalName || ''}</div>
        <div>RUC/RNC: ${settings.rnc || 'J0310000000000'}</div>
        <div>${settings.address || ''}</div>
        <div>Tel: ${settings.phone || ''}</div>
        ${settings.email ? `<div>${settings.email}</div>` : ''}
      </div>

      <div class="divider"></div>

      <div class="center">
        <div class="badge">*** PRUEBA DE IMPRESIÓN ***</div>
        <div style="font-size: 10px;">CONEXIÓN EXITOSA</div>
      </div>

      <div class="divider"></div>

      <div class="row">
        <span>Fecha:</span>
        <span class="bold">${dateStr}</span>
      </div>
      <div class="row">
        <span>Hora:</span>
        <span class="bold">${timeStr}</span>
      </div>
      <div class="row">
        <span>Impresora:</span>
        <span>${cfg.name}</span>
      </div>
      <div class="row">
        <span>Conexión:</span>
        <span class="bold">${cfg.connectionType.toUpperCase()}</span>
      </div>
      <div class="row">
        <span>Papel:</span>
        <span>${cfg.paperWidth}</span>
      </div>
      ${cfg.connectionType === 'network' && cfg.ipAddress ? `
        <div class="row">
          <span>IP Impresora:</span>
          <span>${cfg.ipAddress}:${cfg.port || 9100}</span>
        </div>
      ` : ''}

      ${cfg.ticketHeader ? `
        <div class="divider"></div>
        <div class="center" style="font-style: italic;">${cfg.ticketHeader}</div>
      ` : ''}

      <div class="double-divider"></div>

      <table class="table">
        <thead>
          <tr style="border-bottom: 1px dashed #000;">
            <th align="left">Cant. Descripción</th>
            <th align="right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1x Café Molido 500g</td>
            <td align="right">C$ 180.00</td>
          </tr>
          <tr>
            <td>2x Agua Purificada 1L</td>
            <td align="right">C$ 50.00</td>
          </tr>
        </tbody>
      </table>

      <div class="divider"></div>

      <div class="row">
        <span>SUBTOTAL:</span>
        <span>C$ 200.00</span>
      </div>
      <div class="row">
        <span>IVA (15%):</span>
        <span>C$ 30.00</span>
      </div>
      <div class="row bold" style="font-size: 13px;">
        <span>TOTAL:</span>
        <span>C$ 230.00</span>
      </div>

      <div class="divider"></div>

      <div class="center" style="font-size: 10px;">
        ${cfg.autoPrintOnSale ? '✓ Impresión automática activa<br/>' : ''}
        ${cfg.openCashDrawer ? '✓ Pulso de apertura de gaveta<br/>' : ''}
        ${cfg.cutPaper ? '✓ Comando de corte de papel<br/>' : ''}
      </div>

      ${cfg.ticketFooter ? `
        <div class="divider"></div>
        <div class="center" style="font-size: 10px;">${cfg.ticketFooter}</div>
      ` : ''}

      <div class="center" style="margin-top: 6px; font-size: 9px; color: #555;">
        Factus POS · Sistema de Gestión Empresarial
      </div>

      <div class="cut-space"></div>

      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() {
            window.close();
          }, 600);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
