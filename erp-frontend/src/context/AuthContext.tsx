import { useState, useEffect, type ReactNode } from 'react';
import { ErpAuthContext } from '../store/authStore';
import type { MatchedSystem } from '../types';

const isTokenExpired = (token: string): boolean => {
  try {
    const p = JSON.parse(atob(token.split('.')[1]));
    return p.exp * 1000 < Date.now();
  } catch { return true; }
};

export const ErpAuthProvider = ({ children }: { children: ReactNode }) => {
  const [erpToken,       setErpToken]       = useState<string | null>(null);
  const [matchedSystems, setMatchedSystems] = useState<MatchedSystem[]>([]);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored        = localStorage.getItem('erp_token');
    const storedSystems = localStorage.getItem('erp_matched_systems');
    if (stored && !isTokenExpired(stored)) {
      setErpToken(stored);
      if (storedSystems) {
        try { setMatchedSystems(JSON.parse(storedSystems)); } catch { /* ignore */ }
      }
    } else {
      // Clear stale session
      localStorage.removeItem('erp_token');
      localStorage.removeItem('erp_matched_systems');
    }
  }, []);

  const setLoginResult = (token: string, systems: MatchedSystem[]) => {
    setErpToken(token);
    setMatchedSystems(systems);
    localStorage.setItem('erp_token',           token);
    localStorage.setItem('erp_matched_systems', JSON.stringify(systems));
  };

  const clear = () => {
    setErpToken(null);
    setMatchedSystems([]);
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_matched_systems');
  };

  return (
    <ErpAuthContext.Provider value={{
      erpToken,
      matchedSystems,
      isAuthenticated: !!erpToken && !isTokenExpired(erpToken),
      setLoginResult,
      clear,
    }}>
      {children}
    </ErpAuthContext.Provider>
  );
};
