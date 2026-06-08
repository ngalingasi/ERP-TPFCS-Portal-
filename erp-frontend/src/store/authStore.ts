import { createContext, useContext } from 'react';
import type { MatchedSystem } from '../types';

export interface ErpAuthState {
  erpToken:       string | null;
  matchedSystems: MatchedSystem[];
  isAuthenticated: boolean;
}

export interface ErpAuthActions {
  setLoginResult: (erpToken: string, matchedSystems: MatchedSystem[]) => void;
  clear:          () => void;
}

export type ErpAuthContextType = ErpAuthState & ErpAuthActions;

export const ErpAuthContext = createContext<ErpAuthContextType | null>(null);

export const useErpAuth = (): ErpAuthContextType => {
  const ctx = useContext(ErpAuthContext);
  if (!ctx) throw new Error('useErpAuth must be used within ErpAuthProvider');
  return ctx;
};
