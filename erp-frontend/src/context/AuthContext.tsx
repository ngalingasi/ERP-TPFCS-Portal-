import { useState, type ReactNode } from 'react';
import { ErpAuthContext } from '../store/authStore';
import type { MatchedSystem } from '../types';

export const ErpAuthProvider = ({ children }: { children: ReactNode }) => {
  const [erpToken,       setErpToken]       = useState<string | null>(null);
  const [matchedSystems, setMatchedSystems] = useState<MatchedSystem[]>([]);

  const setLoginResult = (token: string, systems: MatchedSystem[]) => {
    setErpToken(token);
    setMatchedSystems(systems);
    localStorage.setItem('erp_token', token);
  };

  const clear = () => {
    setErpToken(null);
    setMatchedSystems([]);
    localStorage.removeItem('erp_token');
  };

  return (
    <ErpAuthContext.Provider value={{
      erpToken,
      matchedSystems,
      isAuthenticated: !!erpToken,
      setLoginResult,
      clear,
    }}>
      {children}
    </ErpAuthContext.Provider>
  );
};
