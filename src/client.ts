/**
 * @prefid/sdk - Main Client
 * Identity-aware AI memory infrastructure
 */

import type {
    PrefIDConfig,
    PrefIDDomain,
    DomainTypeMap,
    PrefIDSession,
    PrefIDUser,
    PreferenceResponse,
    GenerateResponse
} from './types';
import { PrefIDError, AuthenticationError } from './types';
import { getStoredSession, storeSession, clearSession, updateTokens } from './storage';
import { startLogin, handleCallback, refreshAccessToken, logout as oauthLogout, buildAuthUrl } from './oauth';

const DEFAULT_BASE_URL = 'https://prefid-production.up.railway.app';

/**
 * PrefID SDK Client
 * 
 * @example
 * ```typescript
 * const prefid = new PrefID({ clientId: 'your-client-id' });
 * 
 * // Login
 * await prefid.login();
 * 
 * // Get preferences
 * const food = await prefid.getPreferences('food_profile');
 * console.log(food.cuisines); // ['Italian', 'Indian']
 * ```
 */
export class PrefID {
    private config: PrefIDConfig;
    private session: PrefIDSession | null = null;

    constructor(config: PrefIDConfig) {
        if (!config.clientId) {
            throw new Error('PrefID: clientId is required');
        }

        this.config = {
            baseUrl: DEFAULT_BASE_URL,
            debug: false,
            ...config
        };

        // Restore session from storage
        this.session = getStoredSession();
    }

    // ============================================
    // Authentication Methods
    // ============================================

    /**
     * Start OAuth login flow (redirects to PrefID)
     */
    async login(): Promise<void> {
        return startLogin(this.config);
    }

    /**
     * Build authorization URL without redirecting
     * Useful for custom login buttons or popup windows
     */
    async getAuthUrl(): Promise<string> {
        const { url } = await buildAuthUrl(this.config);
        return url;
    }

    /**
     * Handle OAuth callback after login
     * Call this on your callback page
     */
    async handleCallback(callbackUrl?: string): Promise<PrefIDSession> {
        this.session = await handleCallback(this.config, callbackUrl);
        return this.session;
    }

    /**
     * Logout and clear session
     */
    logout(): void {
        oauthLogout();
        this.session = null;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.session !== null && this.session.tokens.expires_at > Date.now();
    }

    /**
     * Get current user info
     */
    getUser(): PrefIDUser | null {
        return this.session?.user || null;
    }

    /**
     * Get current session
     */
    getSession(): PrefIDSession | null {
        return this.session;
    }

    // ============================================
    // Preference Methods
    // ============================================

    /**
     * Get preferences for a domain
     * 
     * @example
     * ```typescript
     * const food = await prefid.getPreferences('food_profile');
     * // { cuisines: ['Italian'], dietary_restrictions: ['vegetarian'] }
     * ```
     */
    async getPreferences<D extends PrefIDDomain>(
        domain: D
    ): Promise<DomainTypeMap[D]>;

    /**
     * Get preferences for a custom domain (escape hatch)
     */
    async getPreferences(domain: string): Promise<unknown>;

    async getPreferences(domain: string): Promise<unknown> {
        await this.ensureAuthenticated();

        const response = await this.fetch(`/prefid/preferences/${domain}`);
        const data = await response.json();

        return data.data || data;
    }

    /**
     * Update preferences for a domain
     * 
     * @example
     * ```typescript
     * await prefid.updatePreferences('food_profile', {
     *   cuisines: ['Italian', 'Japanese'],
     *   spice_tolerance: 'hot'
     * });
     * ```
     */
    async updatePreferences<D extends PrefIDDomain>(
        domain: D,
        preferences: Partial<DomainTypeMap[D]>
    ): Promise<void>;

    async updatePreferences(domain: string, preferences: unknown): Promise<void>;

    async updatePreferences(domain: string, preferences: unknown): Promise<void> {
        await this.ensureAuthenticated();

        await this.fetch('/prefid/merge', {
            method: 'POST',
            body: JSON.stringify({
                domain,
                preferences,
                source: 'sdk'
            })
        });
    }

    /**
     * Get all preferences across all domains
     */
    async getAllPreferences(): Promise<Record<string, unknown>> {
        await this.ensureAuthenticated();

        const response = await this.fetch('/prefid/preferences');
        return response.json();
    }

    // ============================================
    // Generation Methods
    // ============================================

    /**
     * Generate personalized content based on preferences
     * 
     * @example
     * ```typescript
     * const result = await prefid.generate({
     *   prompt: 'Recommend a restaurant for dinner',
     *   domains: ['food_profile', 'travel_profile']
     * });
     * console.log(result.content);
     * ```
     */
    async generate(options: {
        prompt: string;
        domains?: PrefIDDomain[];
        context?: Record<string, unknown>;
    }): Promise<GenerateResponse> {
        await this.ensureAuthenticated();

        const response = await this.fetch('/prefid/generate', {
            method: 'POST',
            body: JSON.stringify({
                prompt: options.prompt,
                domains: options.domains || ['general_profile'],
                context: options.context || {}
            })
        });

        return response.json();
    }

    // ============================================
    // Thinking Profile (AoT) Methods
    // ============================================

    /**
     * Get thinking profile (Atom of Thought)
     * Returns atoms that govern HOW AI responds
     * 
     * @example
     * ```typescript
     * const profile = await prefid.getThinkingProfile();
     * console.log(profile.atoms); // [{ atom: 'prefers_stepwise_reasoning', ... }]
     * ```
     */
    async getThinkingProfile(): Promise<import('./types').ThinkingProfile> {
        await this.ensureAuthenticated();

        const response = await this.fetch(`/v1/preferences/${this.session!.user.id}/cognitive-profile`);
        return response.json();
    }

    /**
     * Learn a thinking preference
     * Pass a natural language statement about how you want AI to respond
     * 
     * @example
     * ```typescript
     * await prefid.learnThought('I prefer step-by-step explanations');
     * ```
     */
    async learnThought(thought: string): Promise<void> {
        await this.ensureAuthenticated();

        await this.fetch(`/v1/preferences/${this.session!.user.id}/learn-thought`, {
            method: 'POST',
            body: JSON.stringify({ thought })
        });
    }

    /**
     * Get agent hints (clean contract for agents)
     * No internals - just behavior values
     * 
     * @example
     * ```typescript
     * const hints = await prefid.getAgentHints();
     * // { reasoning: 'stepwise', decision: 'recommend', ... }
     * ```
     */
    async getAgentHints(): Promise<import('./types').AgentHints> {
        await this.ensureAuthenticated();

        const response = await this.fetch(`/v1/preferences/${this.session!.user.id}/agent-hints`);
        return response.json();
    }

    /**
     * Get explanation of why AI is responding this way
     * Opt-in introspection based on active atoms
     * 
     * @example
     * ```typescript
     * const why = await prefid.getWhy();
     * console.log(why.explanation);
     * ```
     */
    async getWhy(): Promise<import('./types').WhyResponse> {
        await this.ensureAuthenticated();

        const response = await this.fetch(`/v1/preferences/${this.session!.user.id}/why`);
        return response.json();
    }

    /**
     * Get learning budget status
     * Shows monthly cap, usage, and cooldown state
     * 
     * @example
     * ```typescript
     * const budget = await prefid.getBudgetStatus('thinking_profile');
     * console.log(`${budget.remaining}/${budget.monthly_cap} remaining`);
     * ```
     */
    async getBudgetStatus(profileName: string = 'thinking_profile'): Promise<import('./types').BudgetStatus> {
        await this.ensureAuthenticated();

        const response = await this.fetch(`/v1/preferences/${this.session!.user.id}/budget/${profileName}`);
        return response.json();
    }

    // ============================================
    // Internal Methods
    // ============================================

    /**
     * Ensure user is authenticated, throw if not
     */
    private async ensureAuthenticated(): Promise<void> {
        if (!this.session) {
            throw new AuthenticationError('Not logged in. Call prefid.login() first.');
        }

        // Check if token is about to expire (within 5 minutes)
        if (this.session.tokens.expires_at < Date.now() + 5 * 60 * 1000) {
            try {
                const newTokens = await refreshAccessToken(this.config, this.session.tokens.refresh_token);
                this.session.tokens = newTokens;
                updateTokens(newTokens);
            } catch (error) {
                this.session = null;
                clearSession();
                throw new AuthenticationError('Session expired. Please login again.');
            }
        }
    }

    /**
     * Make authenticated fetch request
     */
    private async fetch(path: string, options: RequestInit = {}): Promise<Response> {
        const url = `${this.config.baseUrl}${path}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...((options.headers as Record<string, string>) || {})
        };

        if (this.session) {
            headers['Authorization'] = `Bearer ${this.session.tokens.access_token}`;
        }

        if (this.config.debug) {
            console.log(`[PrefID] ${options.method || 'GET'} ${path}`);
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));

            if (response.status === 401) {
                this.session = null;
                clearSession();
                throw new AuthenticationError(error.message || 'Session expired');
            }

            throw new PrefIDError(
                error.message || `Request failed: ${response.status}`,
                error.code || 'API_ERROR',
                response.status
            );
        }

        return response;
    }
}
