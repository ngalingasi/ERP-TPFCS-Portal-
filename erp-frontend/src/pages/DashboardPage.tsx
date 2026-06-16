import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ExternalLink, User, ShieldCheck, Monitor, Building2 } from 'lucide-react';
import { redirectToSystem } from '../utils/redirect';
import { useErpAuth } from '../store/authStore';
import PortalNav from '../components/PortalNav';
import type { MatchedSystem } from '../types';

const SystemIcon = ({ icon, size = 22 }: { icon: string; size?: number }) => {
  const map: Record<string, React.ReactNode> = {
    'shield-check':     <ShieldCheck size={size} />,
    'container':        <Monitor size={size} />,
    'layout-dashboard': <Monitor size={size} />,
    'building-2':       <Building2 size={size} />,
    'monitor':          <Monitor size={size} />,
  };
  return <>{map[icon] ?? <Monitor size={size} />}</>;
};

// redirectToSystem imported from utils/redirect

const isTokenExpired = (token: string): boolean => {
  try { const p = JSON.parse(atob(token.split('.')[1])); return p.exp * 1000 < Date.now(); }
  catch { return true; }
};

const decodeErpUser = (token: string) => {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning'; if (h < 17) return 'afternoon'; return 'evening';
}

function firstName(email: string) {
  const local = email.split('@')[0].replace(/[._-]/g, ' ');
  return local.charAt(0).toUpperCase() + local.slice(1).split(' ')[0];
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { erpToken, matchedSystems } = useErpAuth();

  const token    = erpToken ?? localStorage.getItem('erp_token') ?? '';
  const erpUser  = decodeErpUser(token);
  const systems: MatchedSystem[] = matchedSystems.length
    ? matchedSystems
    : JSON.parse(localStorage.getItem('erp_matched_systems') ?? '[]');

  useEffect(() => {
    if (!token || isTokenExpired(token)) navigate('/', { replace: true });
  }, [token, navigate]);

  if (!token || isTokenExpired(token)) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', fontFamily: 'Outfit, sans-serif', transition: 'background 0.2s' }}>
      <PortalNav activePage="dashboard" />

      <main style={{ maxWidth: 1040, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.4px' }}>
            Good {getGreeting()}, {firstName(erpUser?.email ?? 'there')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            You have access to {systems.length} system{systems.length !== 1 ? 's' : ''}. Select one to open it.
          </p>
        </div>

        {/* System cards */}
        {systems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <Monitor size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ margin: 0 }}>No systems found for your account.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
            {systems.map((sys, i) => (
              <button
                key={sys.profile.id}
                onClick={() => redirectToSystem(sys)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 14, padding: '22px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s', boxShadow: 'var(--shadow-card)',
                  animation: `dash-fadeUp 0.35s ${i * 0.06}s ease both`,
                  fontFamily: 'Outfit, sans-serif',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'rgba(70,95,255,0.4)';
                  el.style.transform   = 'translateY(-3px)';
                  el.style.boxShadow   = '0 8px 28px rgba(70,95,255,0.12)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'var(--border)';
                  el.style.transform   = 'translateY(0)';
                  el.style.boxShadow   = 'var(--shadow-card)';
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--brand-soft)', border: '1px solid rgba(70,95,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
                    <SystemIcon icon={sys.profile.icon} size={22} />
                  </div>
                  <ExternalLink size={14} style={{ color: 'var(--text-muted)', marginTop: 3 }} />
                </div>

                {/* Name + desc */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
                    {sys.profile.name}
                  </div>
                  {sys.profile.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {sys.profile.description}
                    </div>
                  )}
                </div>

                {/* Role badge */}
                {sys.user?.role && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 16 }}>
                    <User size={11} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {String(sys.user.role).replace(/_/g, ' ')}
                    </span>
                  </div>
                )}

                {/* Footer */}
                <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>Open system</span>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
                    <ExternalLink size={12} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <style>{`
        @keyframes dash-fadeUp {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @media (max-width: 480px) {
          main { padding: 24px 16px !important; }
        }
      `}</style>
    </div>
  );
}
