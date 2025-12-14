"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AuthenticationError: () => AuthenticationError,
  AuthorizationError: () => AuthorizationError,
  PrefID: () => PrefID,
  PrefIDError: () => PrefIDError,
  buildAuthUrl: () => buildAuthUrl,
  handleCallback: () => handleCallback
});
module.exports = __toCommonJS(index_exports);

// src/types.ts
var PrefIDError = class extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "PrefIDError";
  }
};
var AuthenticationError = class extends PrefIDError {
  constructor(message = "Not authenticated") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthenticationError";
  }
};
var AuthorizationError = class extends PrefIDError {
  constructor(message = "Not authorized") {
    super(message, "FORBIDDEN", 403);
    this.name = "AuthorizationError";
  }
};

// src/storage.ts
var STORAGE_KEY = "prefid_session";
function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}
var memoryStorage = {};
function storeSession(session) {
  const data = JSON.stringify(session);
  if (isBrowser()) {
    try {
      localStorage.setItem(STORAGE_KEY, data);
    } catch {
      memoryStorage[STORAGE_KEY] = data;
    }
  } else {
    memoryStorage[STORAGE_KEY] = data;
  }
}
function getStoredSession() {
  let data = null;
  if (isBrowser()) {
    try {
      data = localStorage.getItem(STORAGE_KEY);
    } catch {
      data = memoryStorage[STORAGE_KEY] || null;
    }
  } else {
    data = memoryStorage[STORAGE_KEY] || null;
  }
  if (!data) return null;
  try {
    const session = JSON.parse(data);
    if (session.tokens.expires_at < Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}
function clearSession() {
  if (isBrowser()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
  }
  delete memoryStorage[STORAGE_KEY];
}
function updateTokens(tokens) {
  const session = getStoredSession();
  if (session) {
    session.tokens = tokens;
    storeSession(session);
  }
}
function generateRandomString(length = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return result;
}
async function generatePKCE() {
  const verifier = generateRandomString(64);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return { verifier, challenge };
  }
  return { verifier, challenge: verifier };
}

// src/oauth.ts
var DEFAULT_BASE_URL = "https://prefid-production.up.railway.app";
var PKCE_STORAGE_KEY = "prefid_pkce";
function storePKCEVerifier(state, verifier) {
  if (isBrowser()) {
    sessionStorage.setItem(`${PKCE_STORAGE_KEY}_${state}`, verifier);
  }
}
function getPKCEVerifier(state) {
  if (!isBrowser()) return null;
  const key = `${PKCE_STORAGE_KEY}_${state}`;
  const verifier = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  return verifier;
}
async function buildAuthUrl(config) {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const redirectUri = config.redirectUri || (isBrowser() ? `${window.location.origin}/callback` : "http://localhost:3000/callback");
  const scopes = config.scopes || ["general_profile"];
  const state = generateRandomString(32);
  const { verifier, challenge } = await generatePKCE();
  storePKCEVerifier(state, verifier);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });
  return {
    url: `${baseUrl}/oauth/authorize?${params.toString()}`,
    state
  };
}
async function startLogin(config) {
  if (!isBrowser()) {
    throw new Error("Login flow requires browser environment");
  }
  const { url } = await buildAuthUrl(config);
  window.location.href = url;
}
async function handleCallback(config, callbackUrl) {
  const url = callbackUrl || (isBrowser() ? window.location.href : "");
  const params = new URL(url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  if (error) {
    throw new AuthenticationError(params.get("error_description") || error);
  }
  if (!code || !state) {
    throw new AuthenticationError("Missing code or state in callback");
  }
  const verifier = getPKCEVerifier(state);
  if (!verifier) {
    throw new AuthenticationError("Session expired or invalid state");
  }
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const redirectUri = config.redirectUri || (isBrowser() ? `${window.location.origin}/callback` : "http://localhost:3000/callback");
  const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier
    })
  });
  if (!tokenResponse.ok) {
    const err = await tokenResponse.json().catch(() => ({}));
    throw new AuthenticationError(err.error_description || "Token exchange failed");
  }
  const tokenData = await tokenResponse.json();
  const tokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: Date.now() + tokenData.expires_in * 1e3,
    token_type: "Bearer"
  };
  const userResponse = await fetch(`${baseUrl}/user/me`, {
    headers: { "Authorization": `Bearer ${tokens.access_token}` }
  });
  let user;
  if (userResponse.ok) {
    user = await userResponse.json();
  } else {
    user = {
      id: tokenData.user_id || "unknown",
      email: tokenData.email || "",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const session = { user, tokens };
  storeSession(session);
  return session;
}
async function refreshAccessToken(config, refreshToken) {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: config.clientId,
      refresh_token: refreshToken
    })
  });
  if (!response.ok) {
    clearSession();
    throw new AuthenticationError("Session expired, please login again");
  }
  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + data.expires_in * 1e3,
    token_type: "Bearer"
  };
}
function logout() {
  clearSession();
}

// src/client.ts
var DEFAULT_BASE_URL2 = "https://prefid-production.up.railway.app";
var PrefID = class {
  constructor(config) {
    this.session = null;
    if (!config.clientId) {
      throw new Error("PrefID: clientId is required");
    }
    this.config = {
      baseUrl: DEFAULT_BASE_URL2,
      debug: false,
      ...config
    };
    this.session = getStoredSession();
  }
  // ============================================
  // Authentication Methods
  // ============================================
  /**
   * Start OAuth login flow (redirects to PrefID)
   */
  async login() {
    return startLogin(this.config);
  }
  /**
   * Build authorization URL without redirecting
   * Useful for custom login buttons or popup windows
   */
  async getAuthUrl() {
    const { url } = await buildAuthUrl(this.config);
    return url;
  }
  /**
   * Handle OAuth callback after login
   * Call this on your callback page
   */
  async handleCallback(callbackUrl) {
    this.session = await handleCallback(this.config, callbackUrl);
    return this.session;
  }
  /**
   * Logout and clear session
   */
  logout() {
    logout();
    this.session = null;
  }
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.session !== null && this.session.tokens.expires_at > Date.now();
  }
  /**
   * Get current user info
   */
  getUser() {
    return this.session?.user || null;
  }
  /**
   * Get current session
   */
  getSession() {
    return this.session;
  }
  async getPreferences(domain) {
    await this.ensureAuthenticated();
    const response = await this.fetch(`/prefid/preferences/${domain}`);
    const data = await response.json();
    return data.data || data;
  }
  async updatePreferences(domain, preferences) {
    await this.ensureAuthenticated();
    await this.fetch("/prefid/merge", {
      method: "POST",
      body: JSON.stringify({
        domain,
        preferences,
        source: "sdk"
      })
    });
  }
  /**
   * Get all preferences across all domains
   */
  async getAllPreferences() {
    await this.ensureAuthenticated();
    const response = await this.fetch("/prefid/preferences");
    return response.json();
  }
  // ============================================
  // Generation Methods
  // ============================================
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
  async generate(options) {
    await this.ensureAuthenticated();
    const response = await this.fetch("/prefid/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt: options.prompt,
        domains: options.domains || ["general_profile"],
        context: options.context || {}
      })
    });
    return response.json();
  }
  // ============================================
  // Internal Methods
  // ============================================
  /**
   * Ensure user is authenticated, throw if not
   */
  async ensureAuthenticated() {
    if (!this.session) {
      throw new AuthenticationError("Not logged in. Call prefid.login() first.");
    }
    if (this.session.tokens.expires_at < Date.now() + 5 * 60 * 1e3) {
      try {
        const newTokens = await refreshAccessToken(this.config, this.session.tokens.refresh_token);
        this.session.tokens = newTokens;
        updateTokens(newTokens);
      } catch (error) {
        this.session = null;
        clearSession();
        throw new AuthenticationError("Session expired. Please login again.");
      }
    }
  }
  /**
   * Make authenticated fetch request
   */
  async fetch(path, options = {}) {
    const url = `${this.config.baseUrl}${path}`;
    const headers = {
      "Content-Type": "application/json",
      ...options.headers || {}
    };
    if (this.session) {
      headers["Authorization"] = `Bearer ${this.session.tokens.access_token}`;
    }
    if (this.config.debug) {
      console.log(`[PrefID] ${options.method || "GET"} ${path}`);
    }
    const response = await fetch(url, {
      ...options,
      headers
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) {
        this.session = null;
        clearSession();
        throw new AuthenticationError(error.message || "Session expired");
      }
      throw new PrefIDError(
        error.message || `Request failed: ${response.status}`,
        error.code || "API_ERROR",
        response.status
      );
    }
    return response;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthenticationError,
  AuthorizationError,
  PrefID,
  PrefIDError,
  buildAuthUrl,
  handleCallback
});
