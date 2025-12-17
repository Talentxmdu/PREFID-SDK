"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.tsx
var index_exports = {};
__export(index_exports, {
  LoginButton: () => LoginButton,
  PrefIDProvider: () => PrefIDProvider,
  usePrefID: () => usePrefID,
  usePreferences: () => usePreferences
});
module.exports = __toCommonJS(index_exports);

// src/context.tsx
var import_react = __toESM(require("react"));
var import_sdk = require("@prefid/sdk");
var PrefIDContext = (0, import_react.createContext)(void 0);
function PrefIDProvider({ children, ...config }) {
  const [prefid] = (0, import_react.useState)(() => new import_sdk.PrefID(config));
  const [user, setUser] = (0, import_react.useState)(null);
  const [isAuthenticated, setIsAuthenticated] = (0, import_react.useState)(false);
  const [isLoading, setIsLoading] = (0, import_react.useState)(true);
  (0, import_react.useEffect)(() => {
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
  return /* @__PURE__ */ import_react.default.createElement(
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
  const context = (0, import_react.useContext)(PrefIDContext);
  if (!context) {
    throw new Error("usePrefID must be used within PrefIDProvider");
  }
  return context;
}

// src/usePreferences.tsx
var import_react2 = require("react");
function usePreferences(domain) {
  const { prefid, isAuthenticated } = usePrefID();
  const [data, setData] = (0, import_react2.useState)(null);
  const [isLoading, setIsLoading] = (0, import_react2.useState)(true);
  const [error, setError] = (0, import_react2.useState)(null);
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
  (0, import_react2.useEffect)(() => {
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
var import_react3 = __toESM(require("react"));
function LoginButton({
  loginText = "Login",
  logoutText = "Logout",
  showUser = false,
  className = "",
  ...props
}) {
  const { isAuthenticated, isLoading, user, login, logout } = usePrefID();
  if (isLoading) {
    return /* @__PURE__ */ import_react3.default.createElement("button", { disabled: true, className, ...props }, "Loading...");
  }
  if (isAuthenticated) {
    return /* @__PURE__ */ import_react3.default.createElement("button", { onClick: logout, className, ...props }, showUser && user?.name ? `${logoutText} (${user.name})` : logoutText);
  }
  return /* @__PURE__ */ import_react3.default.createElement("button", { onClick: login, className, ...props }, loginText);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LoginButton,
  PrefIDProvider,
  usePrefID,
  usePreferences
});
