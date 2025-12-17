/**
 * @prefid/react
 * React hooks and components for PrefID
 * 
 * @example
 * ```tsx
 * import { PrefIDProvider, usePreferences, LoginButton } from '@prefid/react';
 * 
 * function App() {
 *   return (
 *     <PrefIDProvider clientId="your-client-id">
 *       <MyComponent />
 *     </PrefIDProvider>
 *   );
 * }
 * 
 * function MyComponent() {
 *   const { data: food, isLoading } = usePreferences('food_profile');
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   
 *   return <div>Favorite cuisines: {food?.cuisines?.join(', ')}</div>;
 * }
 * ```
 */

// Context & Provider
export { PrefIDProvider, usePrefID } from './context';

// Hooks
export { usePreferences } from './usePreferences';

// Components
export { LoginButton } from './LoginButton';

// Re-export types from SDK
export type {
    PrefIDConfig,
    PrefIDDomain,
    PrefIDUser,
    PrefIDSession,
    DomainTypeMap,
    FoodProfile,
    MusicPreferences,
    TravelProfile,
    CodingProfile,
    CareerProfile,
    FinanceProfile,
    GeneralProfile,
} from '@prefid/sdk';
