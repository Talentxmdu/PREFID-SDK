/**
 * @prefid/react - LoginButton Component
 * Pre-built login/logout button component
 */

import React, { ButtonHTMLAttributes } from 'react';
import { usePrefID } from './context';

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
export function LoginButton({
    loginText = 'Login',
    logoutText = 'Logout',
    showUser = false,
    className = '',
    ...props
}: LoginButtonProps) {
    const { isAuthenticated, isLoading, user, login, logout } = usePrefID();

    if (isLoading) {
        return (
            <button disabled className={className} {...props}>
                Loading...
            </button>
        );
    }

    if (isAuthenticated) {
        return (
            <button onClick={logout} className={className} {...props}>
                {showUser && user?.name ? `${logoutText} (${user.name})` : logoutText}
            </button>
        );
    }

    return (
        <button onClick={login} className={className} {...props}>
            {loginText}
        </button>
    );
}
