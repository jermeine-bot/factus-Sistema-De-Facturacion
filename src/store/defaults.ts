/**
 * Valores iniciales de configuración y usuario administrador local.
 * No contiene datos transaccionales: el dominio se carga desde el backend.
 */

import type { Settings, User } from '@/types';

/** Usuario administrador inicial para permitir el acceso mientras se integra el login del backend. */
export const defaultUsers: User[] = [
  {
    id: 'usr-admin',
    name: 'Administrador Factus',
    email: 'admin@factus.ni',
    role: 'admin',
    pin: '1234',
    avatarColor: '#6366f1',
    isActive: true,
    lastLogin: new Date().toISOString(),
  },
];

export const defaultSettings: Settings = {
  companyName: 'Factus',
  legalName: 'Factus Nicaragua S.A.',
  rnc: 'J0310000457891',
  address: 'Managua, Nicaragua',
  phone: '+505 2277 4545',
  email: 'contacto@factus.ni',
  currency: 'NIO',
  exchangeRate: 36.85,
  taxRate: 0.15,
  cashDrawerRequired: true,
  lowStockAlert: true,
  invoicePrefix: 'F',
  proformaPrefix: 'PRO',
  purchasePrefix: 'CMP',
  expensePrefix: 'GAS',
  footerMessage: '¡Gracias por su compra! Este documento es una representación de la factura.',
  printer: {
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
  },
};
