import { useNavigate } from 'react-router';
import { LogOut, Settings, User } from 'lucide-react';
import { useErpAuth } from '../store/authStore';
import ThemeToggle from './ThemeToggle';

const decodeErpUser = (token: string) => {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
};

const getInitials = (s: string) =>
  s.split(/[@.\s_-]/)[0].slice(0, 2).toUpperCase();

export default function PortalNav({ activePage }: { activePage?: 'dashboard' | 'profile' | 'admin' }) {
  const navigate = useNavigate();
  const { erpToken, clear } = useErpAuth();

  const token    = erpToken ?? localStorage.getItem('erp_token') ?? '';
  const erpUser  = decodeErpUser(token);
  const isSuperAdmin = erpUser?.role === 'super_admin';
  const userName = erpUser?.email ?? 'User';

  const handleLogout = () => {
    clear();
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_matched_systems');
    navigate('/', { replace: true });
  };

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px', height: 60,
      background: 'var(--bg-nav)',
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(10px)',
    }}>
      {/* Logo */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        onClick={() => navigate('/dashboard')}
      >
        <img src="/logo-64.png" alt="TPFCS" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>TPFCS ERP</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1 }}>Portal</div>
        </div>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Manage Profiles — super admin only */}
        {isSuperAdmin && (
          <NavBtn
            icon={<Settings size={14} />}
            label="Profiles"
            active={activePage === 'admin'}
            onClick={() => navigate('/admin')}
            color="brand"
          />
        )}

        {/* Profile */}
        <NavBtn
          icon={<User size={14} />}
          label={userName.split('@')[0]}
          active={activePage === 'profile'}
          onClick={() => navigate('/profile')}
          color="default"
        />

        {/* Sign out */}
        <NavBtn
          icon={<LogOut size={14} />}
          label="Sign out"
          onClick={handleLogout}
          color="danger"
        />
      </div>
    </nav>
  );
}

function NavBtn({ icon, label, active, onClick, color }: {
  icon: React.ReactNode; label: string;
  active?: boolean; onClick: () => void;
  color: 'brand' | 'default' | 'danger';
}) {
  const colors = {
    brand:   { bg: 'rgba(70,95,255,0.1)',  border: 'rgba(70,95,255,0.25)',  text: '#465fff' },
    default: { bg: 'var(--border)',         border: 'var(--border-strong)',   text: 'var(--text-secondary)' },
    danger:  { bg: 'rgba(240,68,56,0.08)', border: 'rgba(240,68,56,0.18)',  text: '#f04438' },
  };
  const c = colors[color];
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 7, border: `1px solid ${c.border}`,
        background: active ? c.bg : 'transparent',
        color: active ? c.text : 'var(--text-muted)',
        fontFamily: 'Outfit, sans-serif', fontSize: 12, fontWeight: 500,
        cursor: 'pointer', transition: 'all 0.18s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = c.bg;
        (e.currentTarget as HTMLButtonElement).style.color = c.text;
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
        }
      }}
    >
      {icon} {label}
    </button>
  );
}
