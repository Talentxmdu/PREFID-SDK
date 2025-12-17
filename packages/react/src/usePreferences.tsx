/**
 * @prefid/react - usePreferences Hook
 * React hook for fetching and managing preferences
 */

import { useState, useEffect } from 'react';
import { PrefIDDomain, DomainTypeMap } from '@prefid/sdk';
import { usePrefID } from './context';

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
export function usePreferences<D extends PrefIDDomain>(
    domain: D
): UsePreferencesResult<DomainTypeMap[D]> {
    const { prefid, isAuthenticated } = usePrefID();
    const [data, setData] = useState<DomainTypeMap[D] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchPreferences = async () => {
        if (!prefid || !isAuthenticated) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            const preferences = await prefid.getPreferences(domain);
            setData(preferences as DomainTypeMap[D]);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    };

    const updatePreferences = async (preferences: Partial<DomainTypeMap[D]>) => {
        if (!prefid) return;

        try {
            await prefid.updatePreferences(domain, preferences);
            await fetchPreferences(); // Refetch after update
        } catch (err) {
            setError(err as Error);
            throw err;
        }
    };

    useEffect(() => {
        fetchPreferences();
    }, [domain, isAuthenticated]);

    return {
        data,
        isLoading,
        error,
        refetch: fetchPreferences,
        update: updatePreferences,
    };
}
