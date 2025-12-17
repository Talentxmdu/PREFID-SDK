/**
 * @prefid/sdk - Type Definitions
 * Identity-aware AI memory infrastructure
 */

// ============================================
// Core Domain Types (v1 - Stable, Governed)
// ============================================

export type PrefIDDomain =
    | 'general_profile'
    | 'music_preferences'
    | 'food_profile'
    | 'travel_profile'
    | 'coding_profile'
    | 'career_profile'
    | 'finance_profile';

// ============================================
// Domain-Specific Preference Types
// ============================================

export interface GeneralProfile {
    name?: string;
    nickname?: string;
    timezone?: string;
    language?: string;
    communication_style?: 'formal' | 'casual' | 'technical';
    interests?: string[];
}

export interface MusicPreferences {
    favorite_genres?: string[];
    favorite_artists?: string[];
    favorite_tracks?: string[];
    listening_mood?: string[];
    discovery_preference?: 'familiar' | 'new' | 'mixed';
    audio_quality_preference?: 'standard' | 'high' | 'lossless';
}

export interface FoodProfile {
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

export interface TravelProfile {
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

export interface CodingProfile {
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

export interface CareerProfile {
    industry?: string;
    role?: string;
    skills?: string[];
    experience_years?: number;
    interests?: string[];
    work_style?: 'remote' | 'hybrid' | 'office';
    goals?: string[];
}

export interface FinanceProfile {
    risk_tolerance?: 'conservative' | 'moderate' | 'aggressive';
    investment_interests?: string[];
    budget_style?: 'strict' | 'flexible' | 'none';
    financial_goals?: string[];
    preferred_payment_methods?: string[];
}

// ============================================
// Thinking Profile (AoT - Atom of Thought)
// ============================================

export interface ThinkingProfile {
    atoms: ThinkingAtom[];
    active_count: number;
    profile_summary?: string;
}

export interface ThinkingAtom {
    atom: string;
    priority_bucket: 'ordering' | 'verbosity' | 'decision' | 'autonomy';
    confidence: number;
    lifecycle_state: 'candidate' | 'active' | 'weakening_active' | 'dormant';
    last_confirmed?: string;
    last_applied_at?: string;
}

export interface AgentHints {
    contract_version: string;
    generated_at: string;
    reasoning: 'stepwise' | 'summary_first' | 'default';
    verbosity: 'concise' | 'detailed' | 'examples' | 'default';
    decision: 'recommend' | 'tradeoffs' | 'options' | 'default';
    autonomy: 'proactive' | 'confirm_first' | 'clarify_first' | 'default';
    description: string;
    atom_count: number;
}

export interface BudgetStatus {
    monthly_cap: number;
    used_this_month: number;
    remaining: number;
    cooldown_days: number;
    cooldown_active: boolean;
    cooldown_until?: string;
    last_learning?: string;
}

export interface WhyResponse {
    explanation: string;
    active_atoms: Array<{
        atom: string;
        bucket: string;
        effect: string;
    }>;
    count: number;
}

// ============================================
// Domain to Type Mapping
// ============================================

export interface DomainTypeMap {
    general_profile: GeneralProfile;
    music_preferences: MusicPreferences;
    food_profile: FoodProfile;
    travel_profile: TravelProfile;
    coding_profile: CodingProfile;
    career_profile: CareerProfile;
    finance_profile: FinanceProfile;
}

// ============================================
// SDK Configuration Types
// ============================================

export interface PrefIDConfig {
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

export interface PrefIDUser {
    id: string;
    email: string;
    name?: string;
    avatar_url?: string;
    created_at: string;
}

export interface PrefIDTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    token_type: 'Bearer';
}

export interface PrefIDSession {
    user: PrefIDUser;
    tokens: PrefIDTokens;
}

// ============================================
// API Response Types
// ============================================

export interface PreferenceResponse<T = unknown> {
    domain: string;
    data: T;
    updated_at: string;
    source: string;
}

export interface GenerateResponse {
    content: string;
    preferences_used: string[];
    model?: string;
}

// ============================================
// Error Types
// ============================================

export class PrefIDError extends Error {
    constructor(
        message: string,
        public code: string,
        public status?: number
    ) {
        super(message);
        this.name = 'PrefIDError';
    }
}

export class AuthenticationError extends PrefIDError {
    constructor(message: string = 'Not authenticated') {
        super(message, 'AUTH_ERROR', 401);
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends PrefIDError {
    constructor(message: string = 'Not authorized') {
        super(message, 'FORBIDDEN', 403);
        this.name = 'AuthorizationError';
    }
}
