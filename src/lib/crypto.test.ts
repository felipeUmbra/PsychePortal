import { describe, it, expect } from 'vitest';
import { sha256, computeEntityHashAsync, computeRecordHash } from './crypto';

describe('sha256', () => {
  it('returns a 64-char lowercase hex digest', async () => {
    const hash = await sha256('hello');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches a known SHA-256 vector', async () => {
    // SHA-256("abc")
    expect(await sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('produces different digests for different inputs', async () => {
    const a = await sha256('a');
    const b = await sha256('b');
    expect(a).not.toBe(b);
  });

  it('is deterministic for the same input', async () => {
    expect(await sha256('deterministic')).toBe(await sha256('deterministic'));
  });
});

describe('computeEntityHashAsync', () => {
  it('hashes stable JSON independent of key insertion order', async () => {
    const left = await computeEntityHashAsync({ a: 1, b: 2, c: 3 });
    const right = await computeEntityHashAsync({ c: 3, a: 1, b: 2 });
    expect(left).toBe(right);
  });

  it('changes when a value changes', async () => {
    expect(await computeEntityHashAsync({ a: 1 })).not.toBe(
      await computeEntityHashAsync({ a: 2 })
    );
  });

  it('handles nested objects', async () => {
    const h = await computeEntityHashAsync({ patient: { name: 'Ana', id: 'x' } });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('computeRecordHash', () => {
  it('chains prevHash + payload (no separator) into a sha256', async () => {
    const prevHash = 'a'.repeat(64);
    const payload = '{"action":"create"}';
    const hash = await computeRecordHash(payload, prevHash);
    expect(hash).toBe(await sha256(prevHash + payload));
  });

  it('changes when prevHash changes (tamper detection)', async () => {
    const hashA = await computeRecordHash('payload', 'p'.repeat(64));
    const hashB = await computeRecordHash('payload', 'q'.repeat(64));
    expect(hashA).not.toBe(hashB);
  });

  it('changes when payload changes', async () => {
    const hashA = await computeRecordHash('payload-A', 'p'.repeat(64));
    const hashB = await computeRecordHash('payload-B', 'p'.repeat(64));
    expect(hashA).not.toBe(hashB);
  });
});