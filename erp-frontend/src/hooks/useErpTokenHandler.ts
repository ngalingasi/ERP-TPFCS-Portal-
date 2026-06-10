/**
 * useErpTokenHandler.ts
 *
 * Reads ERP redirect tokens from URL params and stores them in localStorage
 * BEFORE AuthContext initialises — so the app boots already authenticated.
 *
 * Called as a plain function in main.tsx (before ReactDOM.render),
 * NOT as a React hook, so there is no flash of the login page.
 *
 * Usage in the child frontend's main.tsx:
 *
 *   import { handleErpRedirect } from './hooks/useErpTokenHandler';
 *   handleErpRedirect(); // call before createRoot(...)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * localStorage keys must match exactly what AuthContext reads:
 *   access_token   → token
 *   refresh_token  → refreshToken
 *   tpfcs_user     → minimal user object decoded from JWT payload
 */

const ACCESS_KEY  = 'access_token';
const REFRESH_KEY = 'refresh_token';
const USER_KEY    = 'tpfcs_user';

const isExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

/**
 * Call this once before React mounts.
 * It reads ?token= and ?refreshToken= from the URL,
 * writes them to localStorage, cleans the URL,
 * and returns true if tokens were found and stored.
 */
export const handleErpRedirect = (): boolean => {
  const params       = new URLSearchParams(window.location.search);
  const token        = params.get('token');
  const refreshToken = params.get('refreshToken');

  if (!token) return false;
  if (isExpired(token)) {
    console.warn('[ERP] Received expired token — ignoring redirect');
    return false;
  }

  // Store tokens
  localStorage.setItem(ACCESS_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);

  // Decode user from JWT payload and store so AuthContext finds it immediately
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const existing = localStorage.getItem(USER_KEY);

    // Only write if nothing stored yet — AuthContext will enrich later via /auth/me
    if (!existing) {
      localStorage.setItem(USER_KEY, JSON.stringify({
        user_id: payload.sub,
        email:   payload.email  ?? null,
        role:    payload.role   ?? null,
      }));
    }
  } catch {
    // Non-critical — AuthContext will call /auth/me to get full user
  }

  // Clean URL — remove token params without triggering a reload
  params.delete('token');
  params.delete('refreshToken');
  const clean = window.location.pathname +
    (params.toString() ? `?${params.toString()}` : '') +
    window.location.hash;
  window.history.replaceState({}, '', clean);

  return true;
};

/**
 * Optional React hook version — use this if you prefer hook-based usage.
 * Less ideal than handleErpRedirect() since it runs after first render.
 */
export const useErpTokenHandler = () => {
  // Already handled before mount — nothing to do here if handleErpRedirect() was called
};
