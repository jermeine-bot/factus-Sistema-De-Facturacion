# Factus · Gestión empresarial

Frontend de POS/ERP para comercio nicaragüense. **No incluye datos simulados**: los stores de Zustand arrancan vacíos y la aplicación queda lista para que el equipo de backend conecte la API REST.

La única información local es la configuración inicial y un usuario administrador de respaldo para poder abrir la interfaz mientras se implementa el login del servidor.

## Stack

- **React 18 + TypeScript estricto** (`noUnusedLocals`, sin `any`)
- **Vite 6** + React Router 6 (rutas lazy)
- **Tailwind CSS 3.4** con tema oscuro, glassmorphism y tablas de alta densidad
- **Radix UI** para diálogos, selects, tabs, switches y menús
- **Zustand 5** para el dominio
- **Lucide** para iconografía y un toaster propio

## Inicio rápido

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript
npm run build      # tsc -b + vite build
npm run preview
```

Configura la URL del backend en `.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

**Acceso inicial:** `admin@factus.ni` con PIN `1234`. Es un usuario local provisional; al integrar `/auth/login` será reemplazado por la autenticación del backend.

## Integración con el backend

- El cliente HTTP está en `src/services/apiClient.ts` e incluye token Bearer, manejo de errores y `VITE_API_URL`.
- Los servicios REST tipados están en `src/services/endpoints.ts` (auth, productos, inventario, categorías, clientes, proveedores, ventas, proformas, compras, gastos, caja, configuración y auditoría).
- Cada store expone métodos `set...` para poblar el estado con las respuestas de la API.
- La guía completa de endpoints y contratos está en [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md).

## Módulos

- **Dashboard**: KPIs, tendencia de ventas, mix de pagos, stock bajo, proformas y actividad reciente.
- **POS**: búsqueda por SKU/código de barras, presentaciones múltiples, combos, servicios de precio libre, cliente, moneda NIO/USD, pago único o dividido, cambio y guardado de proforma.
- **Caja**: apertura, movimientos manuales, arqueo por denominaciones (1/5/10/20/50/100/200/500), sobrante/faltante y cierre histórico.
- **Ventas**: filtros, detalle imprimible, exportación CSV y anulación con reversión de stock/crédito/caja.
- **Proformas**: vigencia, carga en POS, conversión a venta en un clic y detalle imprimible.
- **Compras**: proveedores de inventario, líneas por producto/presentación, actualización de costo, crédito o salida de caja.
- **Gastos**: proveedores de gasto, categorías y toggle «sale de la gaveta».
- **Inventario**: tipos `common`, `floating`, `integrated`, `grouped`; stock bloqueado en edición y ajuste absoluto auditado con autorizante y motivo. El kardex se construye con los ajustes reales registrados.
- **Clientes**: límites de crédito, saldo, abonos en efectivo/transferencia y bloqueo automático de ventas que exceden el límite.
- **Proveedores**: separación estricta entre proveedores de compra y de gasto.
- **Reportes**: rangos de 7/14/30/90 días, ventas diarias, margen, medios de pago, top productos/clientes, rentabilidad por categoría y CSV.
- **Administración**: configuración de empresa, IVA, prefijos, tasa de cambio, reglas operativas, usuarios y bitácora de auditoría.

## Reglas de negocio clave

1. **Stock físico inmutable desde el formulario de producto.** Solo se modifica con un ajuste absoluto en Inventario, que registra stock anterior/nuevo, diferencia, motivo, autorizante y auditoría crítica.
2. **Límite de crédito.** Una venta (o pago dividido) con componente de crédito se bloquea si `saldo + crédito > límite`. El intento se registra como evento crítico.
3. **Montos en NIO.** La tasa de cambio (`settings.exchangeRate`) solo convierte para visualización/cobro en USD; los totales se persisten en córdobas.
4. **Caja obligatoria.** Con `cashDrawerRequired` activo, cualquier cobro o gasto en efectivo exige una sesión abierta.
5. **Proveedores tipados.** Compras rechazan proveedores de gasto y viceversa. Solo los pagos en efectivo pueden afectar la gaveta.
6. **Combos y presentaciones.** Los combos descuentan stock de sus componentes; las presentaciones convierten por `ratio` a la unidad base.
7. **Proforma → venta.** La conversión usa el mismo motor de cobro del POS y marca la proforma como `converted` con vínculo a la factura.

## Estructura

```text
src/
  components/
    layout/        # shell, sidebar, topbar
    shared/        # PageHeader, StatCard, Money, ConfirmDialog…
    ui/            # primitivas Radix/Tailwind
  modules/
    admin/ auth/ cash/ customers/ dashboard/ inventory/
    pos/ purchases/ reports/ sales/ suppliers/
  services/        # cliente HTTP y endpoints REST
  store/           # Zustand (estado vacío, sin datos mock)
  types/           # contratos estrictos del dominio
  utils/           # dinero, CSV, disponibilidad, secuencias
```

## Impresión

Las facturas y proformas usan la hoja `.print-sheet`. En impresión se oculta el shell (`#root`) y el overlay del diálogo, dejando únicamente el documento en blanco y negro legible.
