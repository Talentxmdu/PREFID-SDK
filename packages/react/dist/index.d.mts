import React, { ReactNode, ButtonHTMLAttributes } from 'react';
import { PrefIDConfig, PrefID, PrefIDUser, PrefIDDomain, DomainTypeMap } from '@prefid/sdk';
export { CareerProfile, CodingProfile, DomainTypeMap, FinanceProfile, FoodProfile, GeneralProfile, MusicPreferences, PrefIDConfig, PrefIDDomain, PrefIDSession, PrefIDUser, TravelProfile } from '@prefid/sdk';

/**
 * @prefid/react - React Context
 * Provider and context for PrefID SDK
 */

interface PrefIDContextValue {
    prefid: PrefID | null;
    user: PrefIDUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => void;
}
interface PrefIDProviderProps extends PrefIDConfig {
    children: ReactNode;
}
/**
 * PrefID Provider Component
 * Wraps your app to provide PrefID context
 *
 * @example
 * ```tsx
 * <PrefIDProvider clientId="your-client-id">
 *   <App />
 * </PrefIDProvider>
 * ```
 */
declare function PrefIDProvider({ children, ...config }: PrefIDProviderProps): React.JSX.Element;
/**
 * Hook to access PrefID context
 * Must be used within PrefIDProvider
 */
declare function usePrefID(): PrefIDContextValue;

/**
 * @prefid/react - usePreferences Hook
 * React hook for fetching and managing preferences
 */

interface UsePreferencesResult<T> {
    data: T | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    update: (preferences: Partial<T>) => Promise<void>;
}
/**
 * Hook to fetch and update preferences for a domain
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { data: food, isLoading, update } = usePreferences('food_profile');
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <p>Cuisines: {food?.cuisines?.join(', ')}</p>
 *       <button onClick={() => update({ cuisines: ['Italian', 'Japanese'] })}>
 *         Update
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
declare function usePreferences<D extends PrefIDDomain>(domain: D): UsePreferencesResult<DomainTypeMap[D]>;

/**
 * @prefid/react - LoginButton Component
 * Pre-built login/logout button component
 */

interface LoginButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** Text to show when logged out */
    loginText?: string;
    /** Text to show when logged in */
    logoutText?: string;
    /** Show user name when logged in */
    showUser?: boolean;
}
/**
 * Pre-built Login/Logout Button
 *
 * @example
 * ```tsx
 * <LoginButton
 *   loginText="Sign in with PrefID"
 *   logoutText="Sign out"
 *   showUser
 * />
 * ```
 */
declare function LoginButton({ loginText, logoutText, showUser, className, ...props }: LoginButtonProps): React.JSX.Element;

export { LoginButton, PrefIDProvider, usePrefID, usePreferences };
