# 🚀 Guía de Integración Backend para Factus ERP

Este frontend está desarrollado en **React 18 + TypeScript + Vite + Zustand + TailwindCSS**.  
Todos los datos simulados han sido removidos y la arquitectura está 100% lista para conectarse a tu API Backend (Node.js/Express, NestJS, Python/FastAPI/Django, PHP/Laravel, Go, Spring Boot, etc.).

---

## 1. Configuración de Entorno

En la raíz del proyecto se encuentra el archivo `.env`:

```env
# URL base de tu servidor Backend
VITE_API_URL=http://localhost:3000/api
```

Cuando levantes tu servidor backend, ajusta el puerto o dominio en ese archivo.

---

## 2. Cliente HTTP y Autenticación

El cliente HTTP centralizado se encuentra en:
📁 [`src/services/apiClient.ts`](file:///home/jermiene/Factus/src/services/apiClient.ts)

* **Formato:** Envía y recibe `Content-Type: application/json`.
* **Token JWT:** Se almacena automáticamente en `localStorage` con la clave `factus-auth-token`.
* **Cabecera de Autorización:** Cada petición incluye automáticamente:
  ```http
  Authorization: Bearer <token>
  ```
* **Manejo de Errores:** Errores HTTP con status `4xx` y `5xx` devuelven una excepción `ApiError` extrayendo el mensaje devuelto por el backend (`{ message: "..." }`).

---

## 3. Endpoints REST a Implementar

Todos los métodos y servicios están tipados y listos en:
📁 [`src/services/endpoints.ts`](file:///home/jermiene/Factus/src/services/endpoints.ts)

### 🔐 1. Autenticación y Usuarios
| Método | Endpoint | Descripción | Body esperado |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Iniciar sesión | `{ email?: string, pin: string }` |
| `GET` | `/auth/me` | Obtener usuario de la sesión actual | — |
| `POST` | `/auth/logout` | Cerrar sesión y revocar token | — |
| `GET` | `/users` | Listar colaboradores/usuarios | — |
| `POST` | `/users` | Crear nuevo usuario | `{ name, email, role, pin }` |
| `PUT` | `/users/:id` | Actualizar usuario | `{ name, email, role, pin }` |
| `PATCH` | `/users/:id/toggle-active` | Activar / desactivar usuario | — |

*Usuario administrador local de respaldo (mientras se integra `/auth/login`):* `admin@factus.ni` con PIN `1234`. Una vez conectado el backend, este usuario puede eliminarse o reemplazarse por el flujo real de autenticación.

---

### 📦 2. Catálogo de Productos e Inventario
| Método | Endpoint | Descripción | Body / Query |
| :--- | :--- | :--- | :--- |
| `GET` | `/products` | Listar productos | `?search=&category=&activeOnly=` |
| `GET` | `/products/:id` | Detalle de producto | — |
| `POST` | `/products` | Crear producto maestro | `ProductDraft` (ver tipos) |
| `PUT` | `/products/:id` | Editar producto | `ProductDraft` |
| `DELETE`| `/products/:id` | Eliminar / desactivar | — |
| `POST` | `/inventory/adjust` | Ajuste absoluto auditado de stock | `{ productId, newStock, reason, issuer }` |
| `GET` | `/inventory/adjustments` | Historial de ajustes de inventario | — |

---

### 🏷️ 3. Categorías
| Método | Endpoint | Descripción | Body esperado |
| :--- | :--- | :--- | :--- |
| `GET` | `/categories` | Listar categorías | — |
| `POST` | `/categories` | Crear categoría | `{ name: string, color: string }` |
| `PUT` | `/categories/:id`| Actualizar categoría | `{ name: string, color: string }` |
| `DELETE`| `/categories/:id`| Eliminar categoría | — |

---

### 👥 4. Clientes & Proveedores
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/customers` | Listar clientes (`?search=`) |
| `POST` | `/customers` | Crear cliente |
| `PUT` | `/customers/:id` | Actualizar cliente |
| `POST` | `/customers/:id/balance` | Ajustar saldo / crédito `{ amount, type }` |
| `GET` | `/suppliers` | Listar proveedores (`?search=`) |
| `POST` | `/suppliers` | Crear proveedor |
| `PUT` | `/suppliers/:id` | Actualizar proveedor |
| `POST` | `/suppliers/payments` | Registrar abono a proveedor |

---

### 🛒 5. Ventas, Facturación & POS
| Método | Endpoint | Descripción | Body esperado |
| :--- | :--- | :--- | :--- |
| `GET` | `/sales` | Listar facturas/ventas | `?from=&to=&customerId=` |
| `GET` | `/sales/:id` | Detalle de factura | — |
| `POST` | `/sales` | Registrar venta completada | `{ items, payments, change, customerId, notes }` |
| `POST` | `/sales/:id/void` | Anular factura | `{ reason: string }` |
| `POST` | `/sales/:id/credit-note` | Emitir nota de crédito / devolución | `{ reason: string }` |

---

### 📋 6. Proformas (Cotizaciones)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/proformas` | Listar proformas activas |
| `POST` | `/proformas` | Crear cotización / proforma |
| `POST` | `/proformas/:id/convert`| Convertir proforma en venta definitiva |

---

### 📥 7. Compras & Gastos
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/purchases` | Historial de compras a proveedores |
| `POST` | `/purchases` | Registrar compra (incrementa stock) |
| `POST` | `/purchases/:id/cancel` | Cancelar compra |
| `GET` | `/purchases/orders` | Listar órdenes de compra |
| `POST` | `/purchases/orders` | Crear orden de compra |
| `POST` | `/purchases/orders/:id/receive` | Marcar orden como recibida |
| `GET` | `/expenses` | Historial de gastos operativos |
| `POST` | `/expenses` | Registrar gasto |

---

### 💵 8. Caja y Control de Turnos
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/cash/current` | Sesión de caja actualmente abierta (o `null`) |
| `POST` | `/cash/open` | Abrir turno de caja `{ initialAmount, notes, userName }` |
| `POST` | `/cash/close` | Cierre y arqueo `{ countedCash, notes, closedBy }` |
| `POST` | `/cash/movements` | Entrada / Salida de efectivo manual |
| `GET` | `/cash/history` | Historial de cierres de caja |

---

### ⚙️ 9. Configuración del Sistema
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/settings` | Obtener datos de la empresa, moneda, IVA, impresora |
| `PUT` | `/settings` | Actualizar configuración general |
| `POST` | `/settings/exchange-rate` | Actualizar tasa de cambio USD/NIO |

---

## 4. Tipos de Datos (TypeScript)

Los contratos de TypeScript completos de todas las entidades (`Product`, `Sale`, `Customer`, `Settings`, etc.) se encuentran en:
📁 [`src/types/index.ts`](file:///home/jermiene/Factus/src/types/index.ts)

---

## 5. Cómo poblar los Stores al recibir datos del Backend

Cada store de Zustand incluye métodos `set...` listos para poblar el estado con las respuestas de tu API:

```typescript
import { productsService, salesService, customersService, settingsService } from '@/services';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useSalesStore } from '@/store/useSalesStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Cargar productos desde el backend:
const products = await productsService.getAll();
useCatalogStore.getState().setProducts(products);

// Cargar ventas:
const sales = await salesService.getAll();
useSalesStore.getState().setSales(sales);

// Cargar clientes:
const customers = await customersService.getAll();
useCatalogStore.getState().setCustomers(customers);

// Cargar configuración de la empresa:
const settings = await settingsService.getSettings();
useSettingsStore.getState().setSettings(settings);
```
