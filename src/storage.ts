/**
 * @prefid/sdk - Storage Utilities
 * Secure token storage for browser and Node.js environments
 */

import type { PrefIDTokens, PrefIDSession } from './types';

const STORAGE_KEY = 'prefid_session';

/**
 * Detect if running in browser environment
 */
export function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * In-memory fallback for Node.js / non-browser environments
 */
let memoryStorage: Record<string, string> = {};

/**
 * Store session data
 */
export function storeSession(session: PrefIDSession): void {
    const data = JSON.stringify(session);

    if (isBrowser()) {
        try {
            localStorage.setItem(STORAGE_KEY, data);
        } catch {
            memoryStorage[STORAGE_KEY] = data;
        }
    } else {
        memoryStorage[STORAGE_KEY] = data;
    }
}

/**
 * Retrieve stored session
 */
export function getStoredSession(): PrefIDSession | null {
    let data: string | null = null;

    if (isBrowser()) {
        try {
            data = localStorage.getItem(STORAGE_KEY);
        } catch {
            data = memoryStorage[STORAGE_KEY] || null;
        }
    } else {
        data = memoryStorage[STORAGE_KEY] || null;
    }

    if (!data) return null;

    try {
        const session = JSON.parse(data) as PrefIDSession;

        // Check if token is expired
        if (session.tokens.expires_at < Date.now()) {
            clearSession();
            return null;
        }

        return session;
    } catch {
        return null;
    }
}

/**
 * Clear stored session
 */
export function clearSession(): void {
    if (isBrowser()) {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Ignore
        }
    }
    delete memoryStorage[STORAGE_KEY];
}

/**
 * Update tokens in existing session
 */
export function updateTokens(tokens: PrefIDTokens): void {
    const session = getStoredSession();
    if (session) {
        session.tokens = tokens;
        storeSession(session);
    }
}

/**
 * Generate random string for state/PKCE
 */
export function generateRandomString(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
            result += chars[array[i] % chars.length];
        }
    } else {
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
    }

    return result;
}

/**
 * Generate PKCE code verifier and challenge
 */
export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
    const verifier = generateRandomString(64);

    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const hash = await crypto.subtle.digest('SHA-256', data);
        const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        return { verifier, challenge };
    }

    // Fallback: use verifier as challenge (plain method)
    return { verifier, challenge: verifier };
}
