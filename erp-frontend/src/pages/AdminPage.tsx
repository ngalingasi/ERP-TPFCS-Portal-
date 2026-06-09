import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Star, StarOff, Eye, EyeOff,
  ShieldCheck, Monitor, X, AlertCircle, CheckCircle, Loader2,
} from 'lucide-react';
import { profilesApi } from '../api/profiles';
import type { SoftwareProfile } from '../types';

const B = {
  brand500: '#465fff', brand600: '#3641f5', brand400: '#7592ff',
  gray950: '#0c111d', gray900: '#101828', gray800: '#1d2939',
  gray700: '#344054', gray600: '#475467', gray500: '#667085',
  gray400: '#98a2b3', gray300: '#d0d5dd', gray200: '#e4e7ec',
  gray100: '#f2f4f7', gray50: '#f9fafb',
  success: '#12b76a', error: '#f04438',
};

const inp: React.CSSProperties = {
  width: '100%', height: 42,
  padding: '0 12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: B.gray50,
  fontFamily: 'Outfit, sans-serif', fontSize: 14, outline: 'none',
};

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500,
  color: B.gray400, marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.4px',
};

const ICON_MAP: Record<string, React.ReactNode> = {
  'shield-check':     <ShieldCheck size={20} />,
  'container':        <Monitor size={20} />,
  'layout-dashboard': <Monitor size={20} />,
  'building-2':       <Monitor size={20} />,
  'monitor':          <Monitor size={20} />,
};

const SystemIcon = ({ icon }: { icon: string }) =>
  <>{ICON_MAP[icon] ?? <Monitor size={20} />}</>;

type FormMode = 'create' | 'edit' | null;

const EMPTY: any = {
  name: '', description: '', api_base_url: '', app_url: '',
  icon: '', erp_secret: '', is_active: true, sort_order: 0,
};

export default function AdminPage() {
  const [profiles,   setProfiles]  = useState<SoftwareProfile[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [mode,       setMode]      = useState<FormMode>(null);
  const [editId,     setEditId]    = useState<number | null>(null);
  const [form,       setForm]      = useState({ ...EMPTY });
  const [saving,     setSaving]    = useState(false);
  const [error,      setError]     = useState('');
  const [success,    setSuccess]   = useState('');
  const [showSecret, setShowSec]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await profilesApi.list(false);
      setProfiles(data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load profiles');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm({ ...EMPTY }); setEditId(null); setMode('create'); setError(''); setSuccess(''); };
  const openEdit   = (p: SoftwareProfile) => {
    setForm({ name: p.name, description: p.description || '', api_base_url: p.api_base_url, app_url: p.app_url, icon: p.icon, erp_secret: '', is_active: p.is_active, sort_order: p.sort_order });
    setEditId(p.id); setMode('edit'); setError(''); setSuccess('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (mode === 'create') {
        await profilesApi.create(form as any);
        setSuccess('Profile created successfully');
      } else if (editId !== null) {
        const body: any = { ...form };
        if (!body.erp_secret) delete body.erp_secret;
        await profilesApi.update(editId, body);
        setSuccess('Profile updated successfully');
      }
      await load(); setMode(null);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleSetDefault = async (id: number) => {
    try { await profilesApi.setDefault(id); setSuccess('Default system updated'); await load(); }
    catch (e: any) { setError(e.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try { await profilesApi.remove(id); setSuccess(`"${name}" deleted`); await load(); }
    catch (e: any) { setError(e.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Outfit, sans-serif', background: B.gray950, color: B.gray50, padding: '40px 24px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.2px' }}>Software Profiles</h1>
            <p style={{ fontSize: 13, color: B.gray500, margin: 0 }}>Manage systems accessible through the ERP portal</p>
          </div>
          <button
            onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: B.brand500, border: 'none', borderRadius: 9, color: '#fff', fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={15} /> Add Profile
          </button>
        </div>

        {/* Alert */}
        {(error || success) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 14px', borderRadius: 9, marginBottom: 20, fontSize: 13,
            background: error ? 'rgba(240,68,56,0.08)' : 'rgba(18,183,106,0.08)',
            border: `1px solid ${error ? 'rgba(240,68,56,0.22)' : 'rgba(18,183,106,0.22)'}`,
            color: error ? '#fda29b' : '#6ce9a6',
          }}>
            {error ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
            <span style={{ flex: 1 }}>{error || success}</span>
            <button onClick={() => { setError(''); setSuccess(''); }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex' }}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: B.gray600, padding: '24px 0' }}>
            <Loader2 size={16} style={{ animation: 'erp-spin 0.8s linear infinite' }} /> Loading…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {profiles.map(p => (
              <div key={p.id} style={{
                background: 'rgba(255,255,255,0.025)',
                border: `1px solid ${p.is_default ? 'rgba(70,95,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 12, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(70,95,255,0.1)', border: '1px solid rgba(70,95,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: B.brand400, flexShrink: 0 }}>
                  <SystemIcon icon={p.icon} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                    {p.is_default && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(70,95,255,0.15)', color: B.brand400, border: '1px solid rgba(70,95,255,0.28)', fontWeight: 500 }}>DEFAULT</span>
                    )}
                    {!p.is_active && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(240,68,56,0.1)', color: '#fda29b', border: '1px solid rgba(240,68,56,0.25)' }}>INACTIVE</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: B.gray600, fontFamily: 'monospace' }}>{p.api_base_url}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {!p.is_default && (
                    <button
                      onClick={() => handleSetDefault(p.id)}
                      title="Set as default"
                      style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(70,95,255,0.08)', border: '1px solid rgba(70,95,255,0.18)', borderRadius: 7, color: B.brand400, cursor: 'pointer' }}
                    >
                      <Star size={15} />
                    </button>
                  )}
                  {p.is_default && (
                    <div style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(70,95,255,0.12)', border: '1px solid rgba(70,95,255,0.25)', borderRadius: 7, color: B.brand400 }}>
                      <StarOff size={15} />
                    </div>
                  )}
                  <button
                    onClick={() => openEdit(p)}
                    title="Edit"
                    style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 7, color: B.gray300, cursor: 'pointer' }}
                  >
                    <Pencil size={14} />
                  </button>
                  {!p.is_default && (
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      title="Delete"
                      style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(240,68,56,0.07)', border: '1px solid rgba(240,68,56,0.18)', borderRadius: 7, color: '#fda29b', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {mode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div style={{ background: '#0d1321', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', fontFamily: 'Outfit, sans-serif' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{mode === 'create' ? 'Add Software Profile' : 'Edit Profile'}</h2>
              <button onClick={() => { setMode(null); setError(''); }} style={{ background: 'none', border: 'none', color: B.gray500, cursor: 'pointer', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {error && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8, marginBottom: 16, background: 'rgba(240,68,56,0.08)', border: '1px solid rgba(240,68,56,0.22)', color: '#fda29b', fontSize: 13 }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            <form onSubmit={handleSave}>
              {[
                { key: 'name',         label: 'System Name *',    ph: 'e.g. URA Security System' },
                { key: 'description',  label: 'Description',      ph: 'Brief description (optional)' },
                { key: 'api_base_url', label: 'API Base URL *',    ph: 'http://localhost:3001' },
                { key: 'app_url',      label: 'App URL *',         ph: 'http://localhost:5175' },
                { key: 'icon',         label: 'Icon (lucide name)', ph: 'shield-check, monitor, building-2…' },
                { key: 'sort_order',   label: 'Sort Order',         ph: '0' },
              ].map(({ key, label, ph }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={lbl}>{label}</label>
                  <input
                    style={inp}
                    placeholder={ph}
                    value={(form as any)[key]}
                    onChange={e => setForm((f: any) => ({ ...f, [key]: key === 'sort_order' ? Number(e.target.value) : e.target.value }))}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>ERP Secret Key {mode === 'create' ? '*' : '(blank = keep existing)'}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={inp}
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Minimum 16 characters"
                    value={form.erp_secret}
                    onChange={e => setForm((f: any) => ({ ...f, erp_secret: e.target.value }))}
                  />
                  <button type="button" onClick={() => setShowSec(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: B.gray500, cursor: 'pointer', display: 'flex' }}>
                    {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: B.gray700, marginTop: 5 }}>Must match ERP_SECRET in the child system's .env file</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} style={{ width: 16, height: 16, accentColor: B.brand500 }} />
                <label htmlFor="is_active" style={{ fontSize: 13, color: B.gray300, cursor: 'pointer' }}>Active</label>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ flex: 1, height: 42, background: B.brand500, border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'Outfit, sans-serif', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? <><Loader2 size={15} style={{ animation: 'erp-spin 0.8s linear infinite' }} /> Saving…</> : mode === 'create' ? 'Create Profile' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode(null); setError(''); }}
                  style={{ height: 42, padding: '0 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: B.gray300, fontFamily: 'Outfit, sans-serif', fontSize: 14, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes erp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
