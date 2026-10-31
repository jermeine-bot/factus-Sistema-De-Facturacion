import type { Currency, SaleTotals } from '@/types';
import { useUIStore } from '@/store/useUIStore';

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  NIO: 'C$',
  USD: '$',
};

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toNumber(value: string | number, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Amounts are always persisted in NIO; this only converts for display. */
export function convertCurrency(amountNio: number, currency: Currency, rate: number): number {
  if (currency === 'NIO') return round2(amountNio);
  return round2(amountNio / (rate || 1));
}

/** Format an NIO base amount using the active display currency (override with a Currency). */
export function formatMoney(amountNio: number, rate?: number): string;
export function formatMoney(amountNio: number, currency?: Currency, rate?: number): string;
export function formatMoney(amountNio: number, currencyOrRate?: Currency | number, rate = 36.85): string {
  const target =
    typeof currencyOrRate === 'string' ? currencyOrRate : useUIStore.getState().displayCurrency;
  const effectiveRate = typeof currencyOrRate === 'number' ? currencyOrRate : rate;
  const converted = convertCurrency(amountNio, target, effectiveRate);
  const formatted = new Intl.NumberFormat('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(converted);
  return `${CURRENCY_SYMBOL[target]} ${formatted}`;
}

/**
 * KPI-friendly money: keeps cents for amounts below 10k, drops them above so
 * headline cards never truncate within dense dashboard grids.
 */
export function formatMoneyStat(amountNio: number, rate?: number): string;
export function formatMoneyStat(amountNio: number, currency?: Currency, rate?: number): string;
export function formatMoneyStat(amountNio: number, currencyOrRate?: Currency | number, rate = 36.85): string {
  const target =
    typeof currencyOrRate === 'string' ? currencyOrRate : useUIStore.getState().displayCurrency;
  const effectiveRate = typeof currencyOrRate === 'number' ? currencyOrRate : rate;
  const converted = convertCurrency(amountNio, target, effectiveRate);
  const decimals = Math.abs(converted) >= 10000 ? 0 : 2;
  const formatted = new Intl.NumberFormat('es-NI', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(converted);
  return `${CURRENCY_SYMBOL[target]} ${formatted}`;
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('es-NI', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${new Intl.NumberFormat('es-NI', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}%`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return formatDate(iso);
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function uid(prefix = 'id'): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

/** IVA is included in the listed price (Nicaraguan retail convention). */
export function computeLineTotal(
  quantity: number,
  unitPrice: number,
  discountPct: number,
): { gross: number; discount: number; total: number } {
  const gross = round2(quantity * unitPrice);
  const discount = round2((gross * clamp(discountPct, 0, 100)) / 100);
  return { gross, discount, total: round2(gross - discount) };
}

export function computeTotals(
  lines: Array<{ quantity: number; unitPrice: number; discount: number; taxRate: number; unitCost: number }>,
): SaleTotals {
  let gross = 0;
  let discount = 0;
  let total = 0;
  let cost = 0;

  for (const line of lines) {
    const lineTotal = computeLineTotal(line.quantity, line.unitPrice, line.discount);
    gross += lineTotal.gross;
    discount += lineTotal.discount;
    total += lineTotal.total;
    cost += line.unitCost * line.quantity;
  }

  const taxRate = lines[0]?.taxRate ?? 0.15;
  const weightedTax = lines.reduce((acc, line) => acc + line.quantity * line.unitPrice * line.taxRate, 0);
  const effectiveRate = gross > 0 ? weightedTax / gross : taxRate;
  const tax = round2(total - total / (1 + effectiveRate));
  const net = round2(total - tax);

  return {
    gross: round2(gross),
    discount: round2(discount),
    subtotal: net,
    tax,
    total: round2(total),
    cost: round2(cost),
    margin: total > 0 ? round2(((total - tax - cost) / total) * 100) : 0,
  };
}

export function stockStatus(stock: number, minStock: number): 'out' | 'low' | 'ok' {
  if (stock <= 0) return 'out';
  if (stock <= minStock) return 'low';
  return 'ok';
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
