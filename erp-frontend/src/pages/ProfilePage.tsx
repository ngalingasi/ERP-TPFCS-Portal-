import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  ShieldCheck, Monitor, Building2, Loader2,
  AlertCircle, RefreshCw, User, Mail, Phone,
  Hash, CheckCircle, XCircle, ExternalLink, ArrowLeft,
} from 'lucide-react';
import { useErpAuth } from '../store/authStore';
import PortalNav from '../components/PortalNav';
import type { MatchedSystem, SystemUser } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const isTokenExpired = (token: string): boolean => {
  try { const p = JSON.parse(atob(token.split('.')[1])); return p.exp * 1000 < Date.now(); }
  catch { return true; }
};

const decodeErpUser = (token: string) => {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
};

const ICON_MAP: Record<string, React.ReactNode> = {
  'shield-check':     <ShieldCheck size={18} />,
  'container':        <Monitor size={18} />,
  'layout-dashboard': <Monitor size={18} />,
  'building-2':       <Building2 size={18} />,
  'monitor':          <Monitor size={18} />,
};

// Fields to display per system user — label, key, icon
const USER_FIELDS = [
  { key: 'full_name',  label: 'Full Name',  icon: <User size={14} /> },
  { key: 'email',      label: 'Email',      icon: <Mail size={14} /> },
  { key: 'username',   label: 'Username',   icon: <Hash size={14} /> },
  { key: 'mobile',     label: 'Mobile',     icon: <Phone size={14} /> },
  { key: 'role',       label: 'Role',       icon: <User size={14} />, format: (v: any) => String(v).replace(/_/g, ' ') },
  { key: 'status',     label: 'Status',     icon: null,
    render: (v: any) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
        padding: '2px 10px', borderRadius: 20, fontWeight: 600,
        background: v === 'active' ? 'rgba(18,183,106,0.1)' : 'rgba(240,68,56,0.1)',
        color: v === 'active' ? '#12b76a' : '#f04438',
        border: `1px solid ${v === 'active' ? 'rgba(18,183,106,0.25)' : 'rgba(240,68,56,0.25)'}`,
      }}>
        {v === 'active' ? <CheckCircle size={11} /> : <XCircle size={11} />}
        {String(v).charAt(0).toUpperCase() + String(v).slice(1)}
      </span>
    ),
  },
  { key: 'gender',     label: 'Gender',     icon: null },
  { key: 'icdv_id',   label: 'ICDV ID',    icon: <Hash size={14} /> },
  { key: 'icdv_name', label: 'ICDV Name',  icon: null },
];

// ── Per-system live fetch ─────────────────────────────────────────────────────
// Fetches via ERP services proxy (POST /health/profile) which calls
// POST /erp/me on the child system using the ERP secret.
// This avoids needing to know each child's /auth/me URL or token format.

interface SystemProfile {
  system:  MatchedSystem;
  user:    SystemUser | null;
  loading: boolean;
  error:   string | null;
}

const fetchUserProfile = async (system: MatchedSystem, erpToken: string): Promise<SystemUser> => {
  const email = system.user?.email;
  if (!email) throw new Error('No email in session');

  const res = await fetch(
    `${(import.meta as any).env?.VITE_ERP_API_URL ?? '/api/v1'}/health/profile?profileId=${system.profile.id}`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${erpToken}`,
      },
      body: JSON.stringify({ email }),
    }
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!data.status) throw new Error(data.error || 'Not found');
  return data.user;
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const navigate = useNavigate();
  const { erpToken, matchedSystems } = useErpAuth();

  const token   = erpToken ?? localStorage.getItem('erp_token') ?? '';
  const erpUser = decodeErpUser(token);
  const systems: MatchedSystem[] = matchedSystems.length
    ? matchedSystems
    : JSON.parse(localStorage.getItem('erp_matched_systems') ?? '[]');

  const [activeTab, setActiveTab] = useState(0);
  const [profiles, setProfiles]   = useState<SystemProfile[]>(
    systems.map(s => ({ system: s, user: s.user, loading: false, error: null }))
  );

  useEffect(() => {
    if (!token || isTokenExpired(token)) { navigate('/', { replace: true }); return; }
  }, [token, navigate]);

  // Live re-fetch all on mount
  useEffect(() => {
    systems.forEach((sys, i) => {
      setProfiles(prev => prev.map((p, idx) => idx === i ? { ...p, loading: true, error: null } : p));
      fetchUserProfile(sys, token)
        .then(user => setProfiles(prev => prev.map((p, idx) => idx === i ? { ...p, user, loading: false } : p)))
        .catch(err => setProfiles(prev => prev.map((p, idx) => idx === i ? { ...p, loading: false, error: err.message } : p)));
    });
  }, []);

  const refetch = (i: number) => {
    setProfiles(prev => prev.map((p, idx) => idx === i ? { ...p, loading: true, error: null } : p));
    fetchUserProfile(systems[i], token)
      .then(user => setProfiles(prev => prev.map((p, idx) => idx === i ? { ...p, user, loading: false } : p)))
      .catch(err => setProfiles(prev => prev.map((p, idx) => idx === i ? { ...p, loading: false, error: err.message } : p)));
  };

  if (!token || isTokenExpired(token)) return null;

  const current = profiles[activeTab];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', fontFamily: 'Outfit, sans-serif', transition: 'background 0.2s' }}>
      <PortalNav activePage="profile" />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 14 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.3px' }}>
            My Profile
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Your account details across all connected systems
          </p>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          borderBottom: '1px solid var(--border)', marginBottom: 28,
          overflowX: 'auto', paddingBottom: 0,
        }}>
          {profiles.map((p, i) => {
            const active = i === activeTab;
            return (
              <button
                key={p.system.profile.id}
                onClick={() => setActiveTab(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '10px 16px', border: 'none', background: 'transparent',
                  fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: active ? 600 : 500,
                  color: active ? 'var(--brand)' : 'var(--text-muted)',
                  cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative',
                  borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
                  marginBottom: -1, transition: 'color 0.18s',
                }}
              >
                <span style={{ color: active ? 'var(--brand)' : 'var(--text-muted)', flexShrink: 0 }}>
                  {ICON_MAP[p.system.profile.icon] ?? <Monitor size={16} />}
                </span>
                {p.system.profile.name}
                {p.loading && (
                  <Loader2 size={12} style={{ animation: 'erp-spin 0.8s linear infinite', color: 'var(--text-muted)' }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {current && (
          <div style={{ animation: 'prof-fadeIn 0.25s ease both' }}>

            {/* Card header */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '20px 24px', marginBottom: 16,
              boxShadow: 'var(--shadow-card)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--brand-soft)', border: '1px solid rgba(70,95,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', flexShrink: 0 }}>
                  {ICON_MAP[current.system.profile.icon] ?? <Monitor size={22} />}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{current.system.profile.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{current.system.profile.api_base_url}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => refetch(activeTab)}
                  disabled={current.loading}
                  title="Refresh"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--brand-soft)', border: '1px solid rgba(70,95,255,0.2)', borderRadius: 7, color: 'var(--brand)', fontFamily: 'Outfit, sans-serif', fontSize: 12, cursor: 'pointer', opacity: current.loading ? 0.5 : 1 }}
                >
                  <RefreshCw size={12} style={{ animation: current.loading ? 'erp-spin 0.8s linear infinite' : 'none' }} />
                  Refresh
                </button>
                <a
                  href={current.system.profile.app_url}
                  target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 7, color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif', fontSize: 12, textDecoration: 'none' }}
                >
                  <ExternalLink size={12} /> Open
                </a>
              </div>
            </div>

            {/* Error state */}
            {current.error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'rgba(240,68,56,0.06)', border: '1px solid rgba(240,68,56,0.18)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#f04438' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Could not fetch live data</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Showing last known data. {current.error}</div>
                </div>
              </div>
            )}

            {/* Loading skeleton */}
            {current.loading && !current.user && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-card)' }}>
                {[1,2,3,4].map(n => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                    <div style={{ width: 100, height: 12, borderRadius: 6, background: 'var(--border)', flexShrink: 0 }} />
                    <div style={{ flex: 1, height: 12, borderRadius: 6, background: 'var(--border)', maxWidth: 200 }} />
                  </div>
                ))}
              </div>
            )}

            {/* User details */}
            {current.user && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
                {USER_FIELDS
                  .filter(f => {
                    const v = current.user![f.key as keyof SystemUser];
                    return v !== null && v !== undefined && v !== '';
                  })
                  .map((f, idx, arr) => {
                    const raw   = current.user![f.key as keyof SystemUser];
                    const value = f.format ? f.format(raw) : raw;
                    const isLast = idx === arr.length - 1;
                    return (
                      <div key={f.key} style={{
                        display: 'flex', alignItems: 'center',
                        padding: '14px 24px',
                        borderBottom: isLast ? 'none' : '1px solid var(--border)',
                        gap: 16,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 130, flexShrink: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                          {f.icon && <span style={{ flexShrink: 0 }}>{f.icon}</span>}
                          {f.label}
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, flex: 1 }}>
                          {f.render ? f.render(raw) : String(value)}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>
        )}

        {systems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <p>No connected systems found in your session.</p>
          </div>
        )}
      </main>

      <style>{`
        @keyframes erp-spin   { to { transform: rotate(360deg); } }
        @keyframes prof-fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 480px) {
          main { padding: 20px 12px !important; }
        }
      `}</style>
    </div>
  );
}
