import { round2 } from '@/utils/format';
import type { Denomination } from '@/types';

export const DENOMINATIONS: Denomination[] = [1, 5, 10, 20, 50, 100, 200, 500];

export function countDenominations(counts: Record<number, number>): number {
  return round2(
    DENOMINATIONS.reduce((total, denom) => total + denom * (counts[denom] ?? 0), 0),
  );
}

export function arqueoDifference(counted: number, expected: number): number {
  return round2(counted - expected);
}

export function changeFor(paid: number, total: number): number {
  return round2(Math.max(0, paid - total));
}

export function margin(cost: number, price: number): number {
  if (price <= 0) return 0;
  return round2(((price - cost) / price) * 100);
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}
