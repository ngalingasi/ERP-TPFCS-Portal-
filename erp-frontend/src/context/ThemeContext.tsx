import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode:      ThemeMode;
  resolved:  'light' | 'dark';   // actual applied theme
  setMode:   (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

const getSystemTheme = (): 'light' | 'dark' =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('erp_theme') as ThemeMode) ?? 'system';
  });

  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    mode === 'system' ? getSystemTheme() : mode
  );

  useEffect(() => {
    const apply = (m: ThemeMode) => {
      const r = m === 'system' ? getSystemTheme() : m;
      setResolved(r);
      document.documentElement.classList.toggle('dark', r === 'dark');
    };
    apply(mode);

    // Listen for system changes when mode = 'system'
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (mode === 'system') apply('system'); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    localStorage.setItem('erp_theme', m);
    setModeState(m);
  };

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
