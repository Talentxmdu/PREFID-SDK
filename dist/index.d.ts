/**
 * @prefid/sdk - Type Definitions
 * Identity-aware AI memory infrastructure
 */
type PrefIDDomain = 'general_profile' | 'music_preferences' | 'food_profile' | 'travel_profile' | 'coding_profile' | 'career_profile' | 'finance_profile';
interface GeneralProfile {
    name?: string;
    nickname?: string;
    timezone?: string;
    language?: string;
    communication_style?: 'formal' | 'casual' | 'technical';
    interests?: string[];
}
interface MusicPreferences {
    favorite_genres?: string[];
    favorite_artists?: string[];
    favorite_tracks?: string[];
    listening_mood?: string[];
    discovery_preference?: 'familiar' | 'new' | 'mixed';
    audio_quality_preference?: 'standard' | 'high' | 'lossless';
}
interface FoodProfile {
    cuisines?: string[];
    dietary_restrictions?: string[];
    allergies?: string[];
    spice_tolerance?: 'none' | 'mild' | 'medium' | 'hot' | 'extreme';
    favorite_dishes?: string[];
    avoid_ingredients?: string[];
    meal_preferences?: {
        breakfast?: string[];
        lunch?: string[];
        dinner?: string[];
    };
}
interface TravelProfile {
    preferred_destinations?: string[];
    travel_style?: 'budget' | 'mid-range' | 'luxury';
    accommodation_preference?: 'hotel' | 'hostel' | 'airbnb' | 'resort';
    activities?: string[];
    flight_preferences?: {
        class?: 'economy' | 'premium_economy' | 'business' | 'first';
        seat?: 'window' | 'aisle' | 'middle';
        airline_preferences?: string[];
    };
}
interface CodingProfile {
    languages?: string[];
    frameworks?: string[];
    tools?: string[];
    ide_preference?: string;
    code_style?: {
        indentation?: 'tabs' | 'spaces';
        spaces_count?: 2 | 4;
        semicolons?: boolean;
        quotes?: 'single' | 'double';
    };
    focus_areas?: string[];
}
interface CareerProfile {
    industry?: string;
    role?: string;
    skills?: string[];
    experience_years?: number;
    interests?: string[];
    work_style?: 'remote' | 'hybrid' | 'office';
    goals?: string[];
}
interface FinanceProfile {
    risk_tolerance?: 'conservative' | 'moderate' | 'aggressive';
    investment_interests?: string[];
    budget_style?: 'strict' | 'flexible' | 'none';
    financial_goals?: string[];
    preferred_payment_methods?: string[];
}
interface DomainTypeMap {
    general_profile: GeneralProfile;
    music_preferences: MusicPreferences;
    food_profile: FoodProfile;
    travel_profile: TravelProfile;
    coding_profile: CodingProfile;
    career_profile: CareerProfile;
    finance_profile: FinanceProfile;
}
interface PrefIDConfig {
    /** Your PrefID OAuth client ID */
    clientId: string;
    /** PrefID API base URL (defaults to production) */
    baseUrl?: string;
    /** OAuth redirect URI (defaults to current origin + /callback) */
    redirectUri?: string;
    /** OAuth scopes to request */
    scopes?: PrefIDDomain[];
    /** Enable debug logging */
    debug?: boolean;
}
interface PrefIDUser {
    id: string;
    email: string;
    name?: string;
    avatar_url?: string;
    created_at: string;
}
interface PrefIDTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    token_type: 'Bearer';
}
interface PrefIDSession {
    user: PrefIDUser;
    tokens: PrefIDTokens;
}
interface PreferenceResponse<T = unknown> {
    domain: string;
    data: T;
    updated_at: string;
    source: string;
}
interface GenerateResponse {
    content: string;
    preferences_used: string[];
    model?: string;
}
declare class PrefIDError extends Error {
    code: string;
    status?: number | undefined;
    constructor(message: string, code: string, status?: number | undefined);
}
declare class AuthenticationError extends PrefIDError {
    constructor(message?: string);
}
declare class AuthorizationError extends PrefIDError {
    constructor(message?: string);
}

/**
 * @prefid/sdk - Main Client
 * Identity-aware AI memory infrastructure
 */

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
declare class PrefID {
    private config;
    private session;
    constructor(config: PrefIDConfig);
    /**
     * Start OAuth login flow (redirects to PrefID)
     */
    login(): Promise<void>;
    /**
     * Build authorization URL without redirecting
     * Useful for custom login buttons or popup windows
     */
    getAuthUrl(): Promise<string>;
    /**
     * Handle OAuth callback after login
     * Call this on your callback page
     */
    handleCallback(callbackUrl?: string): Promise<PrefIDSession>;
    /**
     * Logout and clear session
     */
    logout(): void;
    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean;
    /**
     * Get current user info
     */
    getUser(): PrefIDUser | null;
    /**
     * Get current session
     */
    getSession(): PrefIDSession | null;
    /**
     * Get preferences for a domain
     *
     * @example
     * ```typescript
     * const food = await prefid.getPreferences('food_profile');
     * // { cuisines: ['Italian'], dietary_restrictions: ['vegetarian'] }
     * ```
     */
    getPreferences<D extends PrefIDDomain>(domain: D): Promise<DomainTypeMap[D]>;
    /**
     * Get preferences for a custom domain (escape hatch)
     */
    getPreferences(domain: string): Promise<unknown>;
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
    updatePreferences<D extends PrefIDDomain>(domain: D, preferences: Partial<DomainTypeMap[D]>): Promise<void>;
    updatePreferences(domain: string, preferences: unknown): Promise<void>;
    /**
     * Get all preferences across all domains
     */
    getAllPreferences(): Promise<Record<string, unknown>>;
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
    generate(options: {
        prompt: string;
        domains?: PrefIDDomain[];
        context?: Record<string, unknown>;
    }): Promise<GenerateResponse>;
    /**
     * Ensure user is authenticated, throw if not
     */
    private ensureAuthenticated;
    /**
     * Make authenticated fetch request
     */
    private fetch;
}

/**
 * @prefid/sdk - OAuth Utilities
 * PKCE-enabled OAuth 2.0 flow helpers
 */

/**
 * Build the OAuth authorization URL
 */
declare function buildAuthUrl(config: PrefIDConfig): Promise<{
    url: string;
    state: string;
}>;
/**
 * Handle OAuth callback - exchange code for tokens
 */
declare function handleCallback(config: PrefIDConfig, callbackUrl?: string): Promise<PrefIDSession>;

export { AuthenticationError, AuthorizationError, type CareerProfile, type CodingProfile, type DomainTypeMap, type FinanceProfile, type FoodProfile, type GeneralProfile, type GenerateResponse, type MusicPreferences, PrefID, type PrefIDConfig, type PrefIDDomain, PrefIDError, type PrefIDSession, type PrefIDTokens, type PrefIDUser, type PreferenceResponse, type TravelProfile, buildAuthUrl, handleCallback };
