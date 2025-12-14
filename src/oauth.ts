/**
 * @prefid/sdk - OAuth Utilities
 * PKCE-enabled OAuth 2.0 flow helpers
 */

import type { PrefIDConfig, PrefIDTokens, PrefIDSession, PrefIDUser } from './types';
import { AuthenticationError } from './types';
import { generateRandomString, generatePKCE, storeSession, clearSession, isBrowser } from './storage';

const DEFAULT_BASE_URL = 'https://prefid-production.up.railway.app';
const PKCE_STORAGE_KEY = 'prefid_pkce';

/**
 * Store PKCE verifier for callback
 */
function storePKCEVerifier(state: string, verifier: string): void {
    if (isBrowser()) {
        sessionStorage.setItem(`${PKCE_STORAGE_KEY}_${state}`, verifier);
    }
}

/**
 * Retrieve and clear PKCE verifier
 */
function getPKCEVerifier(state: string): string | null {
    if (!isBrowser()) return null;

    const key = `${PKCE_STORAGE_KEY}_${state}`;
    const verifier = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return verifier;
}

/**
 * Build the OAuth authorization URL
 */
export async function buildAuthUrl(config: PrefIDConfig): Promise<{ url: string; state: string }> {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    const redirectUri = config.redirectUri || (isBrowser() ? `${window.location.origin}/callback` : 'http://localhost:3000/callback');
    const scopes = config.scopes || ['general_profile'];

    const state = generateRandomString(32);
    const { verifier, challenge } = await generatePKCE();

    // Store verifier for callback
    storePKCEVerifier(state, verifier);

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256'
    });

    return {
        url: `${baseUrl}/oauth/authorize?${params.toString()}`,
        state
    };
}

/**
 * Start the OAuth login flow (redirects to PrefID)
 */
export async function startLogin(config: PrefIDConfig): Promise<void> {
    if (!isBrowser()) {
        throw new Error('Login flow requires browser environment');
    }

    const { url } = await buildAuthUrl(config);
    window.location.href = url;
}

/**
 * Handle OAuth callback - exchange code for tokens
 */
export async function handleCallback(
    config: PrefIDConfig,
    callbackUrl?: string
): Promise<PrefIDSession> {
    const url = callbackUrl || (isBrowser() ? window.location.href : '');
    const params = new URL(url).searchParams;

    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
        throw new AuthenticationError(params.get('error_description') || error);
    }

    if (!code || !state) {
        throw new AuthenticationError('Missing code or state in callback');
    }

    // Get PKCE verifier
    const verifier = getPKCEVerifier(state);
    if (!verifier) {
        throw new AuthenticationError('Session expired or invalid state');
    }

    const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    const redirectUri = config.redirectUri || (isBrowser() ? `${window.location.origin}/callback` : 'http://localhost:3000/callback');

    // Exchange code for tokens
    const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: config.clientId,
            code,
            redirect_uri: redirectUri,
            code_verifier: verifier
        })
    });

    if (!tokenResponse.ok) {
        const err = await tokenResponse.json().catch(() => ({}));
        throw new AuthenticationError(err.error_description || 'Token exchange failed');
    }

    const tokenData = await tokenResponse.json();

    const tokens: PrefIDTokens = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Date.now() + (tokenData.expires_in * 1000),
        token_type: 'Bearer'
    };

    // Fetch user info
    const userResponse = await fetch(`${baseUrl}/user/me`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    let user: PrefIDUser;
    if (userResponse.ok) {
        user = await userResponse.json();
    } else {
        // Minimal user from token
        user = {
            id: tokenData.user_id || 'unknown',
            email: tokenData.email || '',
            created_at: new Date().toISOString()
        };
    }

    const session: PrefIDSession = { user, tokens };
    storeSession(session);

    return session;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
    config: PrefIDConfig,
    refreshToken: string
): Promise<PrefIDTokens> {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

    const response = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'refresh_token',
            client_id: config.clientId,
            refresh_token: refreshToken
        })
    });

    if (!response.ok) {
        clearSession();
        throw new AuthenticationError('Session expired, please login again');
    }

    const data = await response.json();

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        expires_at: Date.now() + (data.expires_in * 1000),
        token_type: 'Bearer'
    };
}

/**
 * Logout - clear session
 */
export function logout(): void {
    clearSession();
}
