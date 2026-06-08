/**
 * useErpTokenHandler.ts
 *
 * Hook to be called once at app startup (in App.tsx or main.tsx).
 *
 * When the ERP portal redirects a user here, it appends:
 *   ?token=<accessToken>&refreshToken=<refreshToken>
 *
 * This hook:
 *  1. Detects those URL params
 *  2. Stores them in localStorage (using the same keys AuthContext reads)
 *  3. Cleans the URL (removes params) so the user sees a clean address bar
 *  4. Triggers an AuthContext re-init if needed
 *
 * Usage — in App.tsx:
 *   import { useErpTokenHandler } from './hooks/useErpTokenHandler';
 *
 *   function AppInitializer() {
 *     useErpTokenHandler();
 *     return null;
 *   }
 *
 *   // Then inside <AuthProvider>:
 *   <AppInitializer />
 */

import { useEffect } from 'react';

const ERP_TOKEN_PARAM         = 'token';
const ERP_REFRESH_TOKEN_PARAM = 'refreshToken';

// localStorage keys must match what AuthContext reads
const ACCESS_TOKEN_KEY  = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY          = 'tpfcs_user';

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const useErpTokenHandler = () => {
  useEffect(() => {
    const params        = new URLSearchParams(window.location.search);
    const token         = params.get(ERP_TOKEN_PARAM);
    const refreshToken  = params.get(ERP_REFRESH_TOKEN_PARAM);

    if (!token) return;

    // Validate the token is actually a JWT and not expired
    if (isTokenExpired(token)) {
      console.warn('[ERP] Received expired token — ignoring');
      return;
    }

    // Store tokens — AuthContext will pick these up on the next render cycle
    localStorage.setItem(ACCESS_TOKEN_KEY,  token);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

    // Try to decode user from token payload and pre-populate user cache
    // (AuthContext will re-fetch /auth/me if the stored user is incomplete)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const cachedUser = localStorage.getItem(USER_KEY);

      // Only overwrite if we don't have a stored user or it's for a different user
      if (!cachedUser) {
        const minimalUser = {
          user_id: payload.sub,
          email:   payload.email ?? null,
          role:    payload.role  ?? null,
        };
        localStorage.setItem(USER_KEY, JSON.stringify(minimalUser));
      }
    } catch {
      // Non-critical — AuthContext will fetch /auth/me
    }

    // Clean URL — remove token params without causing a page reload
    params.delete(ERP_TOKEN_PARAM);
    params.delete(ERP_REFRESH_TOKEN_PARAM);

    const cleanUrl = [
      window.location.pathname,
      params.toString() ? `?${params.toString()}` : '',
      window.location.hash,
    ].join('');

    window.history.replaceState({}, '', cleanUrl);

    // Force a page reload so AuthContext picks up the new localStorage values
    // (avoids needing to expose a "re-init" method on AuthContext)
    window.location.reload();
  }, []);
};
