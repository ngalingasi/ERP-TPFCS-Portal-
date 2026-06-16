import type { MatchedSystem } from '../types';

// Each child system uses a different localStorage key for the user object.
// This maps the system's api_base_url port or name pattern to the correct key.
// The ERP main.tsx token handler in each child also uses these same keys.
const getUserStorageKey = (system: MatchedSystem): string => {
  const name = system.profile.name.toLowerCase();
  const url  = system.profile.api_base_url.toLowerCase();

  // Management System — port 8686 or name contains 'management'
  if (url.includes(':8686') || url.includes('admin.cs') || name.includes('management')) {
    return 'vb_user';
  }
  // URA Security — port 3001 or name contains 'ura'
  if (url.includes(':3001') || url.includes('urasecurity') || name.includes('ura')) {
    return 'ura_user';
  }
  // ICDV / Project Management — use tpfcs_user (default for both)
  return 'tpfcs_user';
};

export const redirectToSystem = (system: MatchedSystem): void => {
  const token        = system.tokens?.access?.token  ?? '';
  const refreshToken = system.tokens?.refresh?.token ?? '';

  if (!token) {
    console.error('No access token for system:', system.profile.name);
    return;
  }

  // Store under the correct key for this child system
  const userKey = getUserStorageKey(system);
  localStorage.setItem('access_token',  token);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem(userKey,         JSON.stringify(system.user));

  // Build redirect URL with token params
  // The child system's main.tsx reads these and sets localStorage before React mounts
  const url = new URL(system.profile.app_url);
  url.searchParams.set('token', token);
  if (refreshToken) url.searchParams.set('refreshToken', refreshToken);

  window.location.href = url.toString();
};
