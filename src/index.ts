/**
 * @prefid/sdk
 * Identity-aware AI memory infrastructure
 * 
 * @example
 * ```typescript
 * import { PrefID } from '@prefid/sdk';
 * 
 * const prefid = new PrefID({ clientId: 'your-client-id' });
 * 
 * // Login
 * await prefid.login();
 * 
 * // Get preferences
 * const food = await prefid.getPreferences('food_profile');
 * console.log(food.cuisines);
 * 
 * // Generate personalized content
 * const response = await prefid.generate({
 *   prompt: 'Recommend a restaurant',
 *   domains: ['food_profile']
 * });
 * ```
 * 
 * @packageDocumentation
 */

// Main client
export { PrefID } from './client';

// Types
export type {
    // Domain types
    PrefIDDomain,
    DomainTypeMap,
    GeneralProfile,
    MusicPreferences,
    FoodProfile,
    TravelProfile,
    CodingProfile,
    CareerProfile,
    FinanceProfile,

    // Config types
    PrefIDConfig,
    PrefIDUser,
    PrefIDTokens,
    PrefIDSession,

    // Response types
    PreferenceResponse,
    GenerateResponse
} from './types';

// Errors
export {
    PrefIDError,
    AuthenticationError,
    AuthorizationError
} from './types';

// Re-export for advanced usage
export { buildAuthUrl, handleCallback } from './oauth';
