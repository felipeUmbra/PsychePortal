import { describe, it, expect } from 'vitest';
import { WORD_LIST } from './word-list';

describe('word-list (BIP-39 subset)', () => {
  it('contains 576 words', () => {
    expect(WORD_LIST).toHaveLength(576);
  });

  it('contains only non-empty strings', () => {
    for (const word of WORD_LIST) {
      expect(typeof word).toBe('string');
      expect(word.length).toBeGreaterThan(0);
    }
  });

  it('contains no duplicates', () => {
    const uniq = new Set(WORD_LIST);
    expect(uniq.size).toBe(WORD_LIST.length);
  });

  it('contains well-known BIP-39 words', () => {
    expect(WORD_LIST).toContain('abandon');
    expect(WORD_LIST).toContain('ability');
    expect(WORD_LIST).toContain('bamboo');
  });
});