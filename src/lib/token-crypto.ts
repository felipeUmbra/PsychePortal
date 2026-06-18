/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Token encryption utility using Web Crypto API
// Provides defense-in-depth against XSS attacks

const ENCRYPTION_KEY_STORAGE = 'psyportal_enc_key';

// Generate or retrieve encryption key
async function getEncryptionKey(): Promise<CryptoKey> {
    if (typeof window === 'undefined') {
        throw new Error('Encryption only available in browser');
    }

    // Try to get existing key from sessionStorage
    const storedKey = sessionStorage.getItem(ENCRYPTION_KEY_STORAGE);
    if (storedKey) {
        try {
            const keyData = JSON.parse(storedKey);
            return await crypto.subtle.importKey(
                'jwk',
                keyData,
                { name: 'AES-GCM' },
                true,
                ['encrypt', 'decrypt']
            );
        } catch {
            // Key invalid, generate new one
        }
    }

    // Generate new key
    const newKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    // Store key for this session
    const exportedKey = await crypto.subtle.exportKey('jwk', newKey);
    sessionStorage.setItem(ENCRYPTION_KEY_STORAGE, JSON.stringify(exportedKey));

    return newKey;
}

// Validate token format (basic JWT-like structure check)
export function validateToken(token: string): boolean {
    if (!token || typeof token !== 'string') return false;

    // Basic validation: should be non-empty string with reasonable length
    if (token.length < 10 || token.length > 2048) return false;

    // Check for suspicious characters that might indicate injection
    const suspiciousChars = ['<', '>', '"', "'", '&', ';', '(', ')', '{', '}'];
    if (suspiciousChars.some(char => token.includes(char))) return false;

    return true;
}

// Encrypt token before storage
export async function encryptToken(token: string): Promise<string> {
    if (!validateToken(token)) {
        throw new Error('Invalid token format');
    }

    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(token);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
}

// Decrypt token from storage
export async function decryptToken(encryptedToken: string): Promise<string> {
    try {
        const key = await getEncryptionKey();
        const combined = new Uint8Array(
            atob(encryptedToken).split('').map(c => c.charCodeAt(0))
        );

        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        return new TextDecoder().decode(decrypted);
    } catch (error) {
        console.error('Token decryption failed:', error);
        return '';
    }
}

// Clear encryption key (call on logout)
export function clearEncryptionKey(): void {
    sessionStorage.removeItem(ENCRYPTION_KEY_STORAGE);
}
