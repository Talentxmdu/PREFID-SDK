/**
 * @prefid/react - React Context
 * Provider and context for PrefID SDK
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PrefID, PrefIDConfig, PrefIDUser } from '@prefid/sdk';

interface PrefIDContextValue {
    prefid: PrefID | null;
    user: PrefIDUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => void;
}

const PrefIDContext = createContext<PrefIDContextValue | undefined>(undefined);

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
export function PrefIDProvider({ children, ...config }: PrefIDProviderProps) {
    const [prefid] = useState(() => new PrefID(config));
    const [user, setUser] = useState<PrefIDUser | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check authentication on mount
        const checkAuth = async () => {
            const authenticated = prefid.isAuthenticated();
            setIsAuthenticated(authenticated);

            if (authenticated) {
                setUser(prefid.getUser());
            }

            setIsLoading(false);
        };

        checkAuth();
    }, [prefid]);

    const login = async () => {
        await prefid.login();
    };

    const logout = () => {
        prefid.logout();
        setUser(null);
        setIsAuthenticated(false);
    };

    return (
        <PrefIDContext.Provider
            value={{
                prefid,
                user,
                isAuthenticated,
                isLoading,
                login,
                logout,
            }}
        >
            {children}
        </PrefIDContext.Provider>
    );
}

/**
 * Hook to access PrefID context
 * Must be used within PrefIDProvider
 */
export function usePrefID() {
    const context = useContext(PrefIDContext);
    if (!context) {
        throw new Error('usePrefID must be used within PrefIDProvider');
    }
    return context;
}
