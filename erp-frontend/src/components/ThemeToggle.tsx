import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

type Option = { value: 'light' | 'dark' | 'system'; icon: React.ReactNode; label: string };

const OPTIONS: Option[] = [
  { value: 'light',  icon: <Sun size={14} />,     label: 'Light'  },
  { value: 'dark',   icon: <Moon size={14} />,    label: 'Dark'   },
  { value: 'system', icon: <Monitor size={14} />, label: 'System' },
];

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <div
      title="Toggle theme"
      style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--border)',
        borderRadius: 8, padding: 3, gap: 1,
        border: '1px solid var(--border-strong)',
      }}
    >
      {OPTIONS.map(opt => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            title={opt.label}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 26, borderRadius: 5, border: 'none',
              background: active ? 'var(--bg-card)' : 'transparent',
              color: active ? 'var(--brand)' : 'var(--text-muted)',
              cursor: 'pointer',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.18s',
            }}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
