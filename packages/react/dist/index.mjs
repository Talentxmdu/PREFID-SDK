// src/context.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { PrefID } from "@prefid/sdk";
var PrefIDContext = createContext(void 0);
function PrefIDProvider({ children, ...config }) {
  const [prefid] = useState(() => new PrefID(config));
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
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
  return /* @__PURE__ */ React.createElement(
    PrefIDContext.Provider,
    {
      value: {
        prefid,
        user,
        isAuthenticated,
        isLoading,
        login,
        logout
      }
    },
    children
  );
}
function usePrefID() {
  const context = useContext(PrefIDContext);
  if (!context) {
    throw new Error("usePrefID must be used within PrefIDProvider");
  }
  return context;
}

// src/usePreferences.tsx
import { useState as useState2, useEffect as useEffect2 } from "react";
function usePreferences(domain) {
  const { prefid, isAuthenticated } = usePrefID();
  const [data, setData] = useState2(null);
  const [isLoading, setIsLoading] = useState2(true);
  const [error, setError] = useState2(null);
  const fetchPreferences = async () => {
    if (!prefid || !isAuthenticated) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const preferences = await prefid.getPreferences(domain);
      setData(preferences);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };
  const updatePreferences = async (preferences) => {
    if (!prefid) return;
    try {
      await prefid.updatePreferences(domain, preferences);
      await fetchPreferences();
    } catch (err) {
      setError(err);
      throw err;
    }
  };
  useEffect2(() => {
    fetchPreferences();
  }, [domain, isAuthenticated]);
  return {
    data,
    isLoading,
    error,
    refetch: fetchPreferences,
    update: updatePreferences
  };
}

// src/LoginButton.tsx
import React2 from "react";
function LoginButton({
  loginText = "Login",
  logoutText = "Logout",
  showUser = false,
  className = "",
  ...props
}) {
  const { isAuthenticated, isLoading, user, login, logout } = usePrefID();
  if (isLoading) {
    return /* @__PURE__ */ React2.createElement("button", { disabled: true, className, ...props }, "Loading...");
  }
  if (isAuthenticated) {
    return /* @__PURE__ */ React2.createElement("button", { onClick: logout, className, ...props }, showUser && user?.name ? `${logoutText} (${user.name})` : logoutText);
  }
  return /* @__PURE__ */ React2.createElement("button", { onClick: login, className, ...props }, loginText);
}
export {
  LoginButton,
  PrefIDProvider,
  usePrefID,
  usePreferences
};
