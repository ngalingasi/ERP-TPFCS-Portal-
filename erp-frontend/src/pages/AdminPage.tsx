import { useState, useEffect } from 'react';
import { profilesApi } from '../api/profiles';
import type { SoftwareProfile } from '../types';

const inputStyle: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 12px',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#e6edf3', fontFamily: 'inherit', fontSize: 14, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: '#8892ab', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500,
};

type FormMode = 'create' | 'edit' | null;

const EMPTY_FORM = {
  name: '', description: '', api_base_url: '', app_url: '',
  icon: '🖥️', erp_secret: '', is_active: true, sort_order: 0,
};

export default function AdminPage() {
  const [profiles,    setProfiles]    = useState<SoftwareProfile[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [mode,        setMode]        = useState<FormMode>(null);
  const [editId,      setEditId]      = useState<number | null>(null);
  const [form,        setForm]        = useState({ ...EMPTY_FORM });
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [showSecret,  setShowSecret]  = useState(false);

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

  const openCreate = () => {
    setForm({ ...EMPTY_FORM }); setEditId(null); setMode('create'); setError(''); setSuccess('');
  };

  const openEdit = (p: SoftwareProfile) => {
    setForm({
      name: p.name, description: p.description || '',
      api_base_url: p.api_base_url, app_url: p.app_url,
      icon: p.icon, erp_secret: '',
      is_active: p.is_active, sort_order: p.sort_order,
    });
    setEditId(p.id); setMode('edit'); setError(''); setSuccess('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      if (mode === 'create') {
        await profilesApi.create(form as any);
        setSuccess('Profile created successfully');
      } else if (editId !== null) {
        const body: any = { ...form };
        if (!body.erp_secret) delete body.erp_secret; // blank = don't change
        await profilesApi.update(editId, body);
        setSuccess('Profile updated successfully');
      }
      await load();
      setMode(null);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await profilesApi.setDefault(id);
      setSuccess('Default system updated');
      await load();
    } catch (e: any) { setError(e.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await profilesApi.remove(id);
      setSuccess(`"${name}" deleted`);
      await load();
    } catch (e: any) { setError(e.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px', maxWidth: 900, margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Software Profiles</h1>
          <p style={{ fontSize: 14, color: '#8892ab', margin: 0 }}>Manage systems accessible through the ERP portal</p>
        </div>
        <button
          onClick={openCreate}
          style={{ padding: '10px 20px', background: '#4f8bff', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          + Add Profile
        </button>
      </div>

      {(error || success) && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 20, fontSize: 13,
          background: error ? 'rgba(248,113,113,0.08)' : 'rgba(45,212,191,0.08)',
          border: `1px solid ${error ? 'rgba(248,113,113,0.25)' : 'rgba(45,212,191,0.25)'}`,
          color: error ? '#f87171' : '#2dd4bf',
        }}>
          {error || success}
          <button onClick={() => { setError(''); setSuccess(''); }} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Profile list */}
      {loading ? (
        <p style={{ color: '#5a6480' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profiles.map((p) => (
            <div key={p.id} style={{
              background: 'rgba(255,255,255,0.03)', border: `1px solid ${p.is_default ? 'rgba(79,139,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{ fontSize: 26, flexShrink: 0 }}>{p.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</span>
                  {p.is_default && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(79,139,255,0.15)', color: '#4f8bff', border: '1px solid rgba(79,139,255,0.3)', fontWeight: 500 }}>DEFAULT</span>
                  )}
                  {!p.is_active && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>INACTIVE</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#8892ab' }}>{p.api_base_url} → {p.app_url}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {!p.is_default && (
                  <button onClick={() => handleSetDefault(p.id)} style={{ padding: '6px 12px', background: 'rgba(79,139,255,0.1)', border: '1px solid rgba(79,139,255,0.2)', borderRadius: 6, color: '#4f8bff', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>
                    Set Default
                  </button>
                )}
                <button onClick={() => openEdit(p)} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e6edf3', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>
                  Edit
                </button>
                {!p.is_default && (
                  <button onClick={() => handleDelete(p.id, p.name)} style={{ padding: '6px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, color: '#f87171', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit form modal */}
      {mode && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, padding: 24,
        }}>
          <div style={{
            background: '#161b22', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 32, width: '100%', maxWidth: 520,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 24px' }}>
              {mode === 'create' ? 'Add Software Profile' : 'Edit Profile'}
            </h2>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontSize: 13 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSave}>
              {[
                { key: 'name',        label: 'System Name *',    placeholder: 'e.g. URA Security System' },
                { key: 'description', label: 'Description',      placeholder: 'Brief description (optional)' },
                { key: 'api_base_url', label: 'API Base URL *',   placeholder: 'http://localhost:3001' },
                { key: 'app_url',     label: 'App URL *',         placeholder: 'http://localhost:5175' },
                { key: 'icon',        label: 'Icon (emoji)',      placeholder: '🛡️' },
                { key: 'sort_order',  label: 'Sort Order',        placeholder: '0' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    style={inputStyle}
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: key === 'sort_order' ? Number(e.target.value) : e.target.value }))}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  ERP Secret Key {mode === 'create' ? '*' : '(leave blank to keep existing)'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={inputStyle}
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Minimum 16 characters"
                    value={form.erp_secret}
                    onChange={(e) => setForm((f) => ({ ...f, erp_secret: e.target.value }))}
                  />
                  <button type="button" onClick={() => setShowSecret((s) => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#5a6480', cursor: 'pointer' }}>
                    {showSecret ? '🙈' : '👁️'}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#5a6480', marginTop: 6 }}>
                  This must match the ERP_SECRET value in the child system's .env file
                </p>
              </div>

              <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: '#4f8bff' }}
                />
                <label htmlFor="is_active" style={{ fontSize: 14, color: '#e6edf3', cursor: 'pointer' }}>Active</label>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={saving} style={{ flex: 1, height: 42, background: '#4f8bff', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : mode === 'create' ? 'Create Profile' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => { setMode(null); setError(''); }} style={{ height: 42, padding: '0 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e6edf3', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
