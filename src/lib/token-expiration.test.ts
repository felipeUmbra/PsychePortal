// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setTokenExpiration,
  isTokenExpiringSoon,
  getTokenTimeRemaining,
  clearTokenExpiration,
  startInactivityTimer,
  resetInactivityTimer,
  clearInactivityTimer,
} from './token-expiration';

// Module constants used in assertions (mirror of token-expiration.ts)
const TOKEN_EXPIRATION_KEY = 'token_expiration_time';
const WARNING_INTERVAL = 5 * 60 * 1000; // 5 minutes

describe('token expiration storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores expiration = now + expiresIn seconds', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    setTokenExpiration(3600);
    expect(sessionStorage.getItem(TOKEN_EXPIRATION_KEY)).toBe(String(1_000_000 + 3600 * 1000));
  });

  it('getTokenTimeRemaining returns positive remaining ms', () => {
    // set expiration 10 min in the future
    sessionStorage.setItem(TOKEN_EXPIRATION_KEY, String(Date.now() + 10 * 60 * 1000));
    const remaining = getTokenTimeRemaining();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  it('getTokenTimeRemaining floors at 0 when expired', () => {
    sessionStorage.setItem(TOKEN_EXPIRATION_KEY, String(Date.now() - 1000));
    expect(getTokenTimeRemaining()).toBe(0);
  });

  it('getTokenTimeRemaining returns 0 when nothing stored', () => {
    expect(getTokenTimeRemaining()).toBe(0);
  });

  it('isTokenExpiringSoon is false when no expiration stored', () => {
    expect(isTokenExpiringSoon()).toBe(false);
  });

  it('isTokenExpiringSoon is true inside the 5-minute warning window', () => {
    const expiry = Date.now() + 60 * 1000; // 1 min away
    sessionStorage.setItem(TOKEN_EXPIRATION_KEY, String(expiry));
    expect(isTokenExpiringSoon()).toBe(true);
  });

  it('isTokenExpiringSoon is false outside the warning window', () => {
    const expiry = Date.now() + WARNING_INTERVAL + 60_000; // > 5 min away
    sessionStorage.setItem(TOKEN_EXPIRATION_KEY, String(expiry));
    expect(isTokenExpiringSoon()).toBe(false);
  });

  it('clearTokenExpiration removes the stored key', () => {
    sessionStorage.setItem(TOKEN_EXPIRATION_KEY, '123');
    clearTokenExpiration();
    expect(sessionStorage.getItem(TOKEN_EXPIRATION_KEY)).toBeNull();
  });

  it('handles storage errors gracefully (isTokenExpiringSoon returns false)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    expect(isTokenExpiringSoon()).toBe(false);
    expect(getTokenTimeRemaining()).toBe(0);
  });
});

describe('inactivity timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires the callback after timeoutMinutes * 60s', () => {
    const cb = vi.fn();
    startInactivityTimer(cb, 30);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30 * 60 * 1000 - 1);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not start a timer for timeoutMinutes <= 0', () => {
    const cb = vi.fn();
    startInactivityTimer(cb, 0);
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('resetInactivityTimer cancels a pending timer', () => {
    const cb = vi.fn();
    startInactivityTimer(cb, 30);
    resetInactivityTimer();
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('restarting replaces the previous timer (start twice -> one fire)', () => {
    const cb = vi.fn();
    startInactivityTimer(cb, 30);
    startInactivityTimer(cb, 30); // resets internally
    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1 * 60 * 1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('clearInactivityTimer is idempotent', () => {
    clearInactivityTimer();
    clearInactivityTimer();
    expect(true).toBe(true);
  });
});