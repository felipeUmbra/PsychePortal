import { describe, it, expect } from 'vitest';
import { cn, sanitizeCsvCell, sanitizeCsvRows } from './utils';

describe('cn', () => {
  it('joins class names with clsx', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('handles conditional/falsy values', () => {
    expect(cn('a', false && 'b', null, undefined, 0 && 'c', 'd')).toBe('a d');
  });

  it('merges conflicting Tailwind utilities (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});

describe('sanitizeCsvCell (OWASP CSV injection, CWE-1236)', () => {
  const dangerous = ['=SUM(A1)', '+2+3', '-1', '@cmd', '\tleading-tab', '\rleading-cr'];

  it('prefixes a single quote to dangerous leading chars', () => {
    for (const value of dangerous) {
      expect(sanitizeCsvCell(value)).toBe(`'${value}`);
    }
  });

  it('leaves safe strings unchanged', () => {
    expect(sanitizeCsvCell('John Doe')).toBe('John Doe');
    expect(sanitizeCsvCell('123')).toBe('123');
    expect(sanitizeCsvCell('  leading space')).toBe('  leading space');
    expect(sanitizeCsvCell('')).toBe('');
  });

  it('passes through non-strings untouched', () => {
    expect(sanitizeCsvCell(42)).toBe(42);
    expect(sanitizeCsvCell(null)).toBe(null);
    expect(sanitizeCsvCell(true)).toBe(true);
    expect(sanitizeCsvCell({ a: 1 })).toEqual({ a: 1 });
  });

  it('does not escape a leading quote that is already escaped', () => {
    // Existing behavior: only the dangerous prefix chars trigger escaping.
    expect(sanitizeCsvCell("'=SUM(A1)")).toBe("'=SUM(A1)");
  });
});

describe('sanitizeCsvRows', () => {
  it('sanitizes every cell of every row', () => {
    const rows = [
      { name: 'Ana', aka: '=HYPERLINK("http://evil")' },
      { name: '+admin', aka: 'safe' },
    ];
    const out = sanitizeCsvRows(rows);
    expect(out[0].aka).toBe("'=HYPERLINK(\"http://evil\")");
    expect(out[1].name).toBe("'+admin");
    expect(out[1].aka).toBe('safe');
  });

  it('keeps keys and non-string values intact', () => {
    const rows = [{ id: 7, note: 'hello', flag: false }];
    const out = sanitizeCsvRows(rows);
    expect(out).toEqual([{ id: 7, note: 'hello', flag: false }]);
  });
});