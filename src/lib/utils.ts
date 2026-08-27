import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Neutralizes spreadsheet formula injection (OWASP CSV injection, CWE-1236).
 * Prefixes a single quote to any string cell starting with '=', '+', '-',
 * '@', tab or carriage return so spreadsheet applications treat it as text.
 */
export function sanitizeCsvCell(value: unknown): unknown {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Applies sanitizeCsvCell to every value of every row before CSV serialization.
 */
export function sanitizeCsvRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      sanitized[key] = sanitizeCsvCell(value);
    }
    return sanitized as T;
  });
}
