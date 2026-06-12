/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Token expiration utilities

const TOKEN_EXPIRATION_KEY = 'token_expiration_time';
const WARNING_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Store expiration time when token is set (expiresIn is in seconds)
export function setTokenExpiration(expiresIn) {
    const expirationTime = Date.now() + (expiresIn * 1000);
    try {
        sessionStorage.setItem(TOKEN_EXPIRATION_KEY, expirationTime.toString());
    } catch {
        // Ignore storage errors
    }
}

// Check if token is expiring soon (within 5 minutes)
export function isTokenExpiringSoon() {
    try {
        const expirationTime = sessionStorage.getItem(TOKEN_EXPIRATION_KEY);
        if (!expirationTime) return false;
        return Date.now() > (parseInt(expirationTime, 10) - WARNING_INTERVAL);
    } catch {
        return false;
    }
}

// Get time remaining until expiration in milliseconds
export function getTokenTimeRemaining() {
    try {
        const expirationTime = sessionStorage.getItem(TOKEN_EXPIRATION_KEY);
        if (!expirationTime) return 0;
        return Math.max(0, parseInt(expirationTime, 10) - Date.now());
    } catch {
        return 0;
    }
}

// Clear expiration time on logout
export function clearTokenExpiration() {
    try {
        sessionStorage.removeItem(TOKEN_EXPIRATION_KEY);
    } catch {
        // Ignore storage errors
    }
}
