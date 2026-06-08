import { useState, useRef, useEffect } from 'react';
import { authApi } from '../api/auth';
import { useErpAuth } from '../store/authStore';
import type { OtpChannel, MatchedSystem } from '../types';

type Step = 'credentials' | 'channel' | 'otp' | 'systems' | 'redirecting';

// ── Redirect helper ─────────────────────────────────────────────────────────
const redirectToSystem = (system: MatchedSystem) => {
  const token        = system.tokens.access?.token   ?? '';
  const refreshToken = system.tokens.refresh?.token  ?? '';

  // Persist tokens using the keys the child frontend reads on startup
  localStorage.setItem('access_token',  token);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('tpfcs_user',    JSON.stringify(system.user));

  const url = new URL(system.profile.app_url);
  if (token)        url.searchParams.set('token',        token);
  if (refreshToken) url.searchParams.set('refreshToken', refreshToken);

  window.location.href = url.toString();
};

// ── Sub-components ───────────────────────────────────────────────────────────

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <path d="M1 1l22 22"/>
    </svg>
  );

const Spinner = ({ size = 16, color = 'white' }: { size?: number; color?: string }) => (
  <div style={{
    width: size, height: size,
    border: `2px solid rgba(${color === 'white' ? '255,255,255' : '79,139,255'},0.25)`,
    borderTopColor: color === 'white' ? '#fff' : '#4f8bff',
    borderRadius: '50%',
    animation: 'spin 0.65s linear infinite',
  }} />
);

const Alert = ({ msg }: { msg: string }) => (
  <div style={{
    padding: '10px 14px', borderRadius: 8, marginBottom: 16,
    background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
    color: '#f87171', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start',
  }}>
    <span>⚠</span> {msg}
  </div>
);

const StepDots = ({ steps, current }: { steps: string[]; current: string }) => {
  const idx = steps.indexOf(current);
  const labels = ['Credentials', 'Verification method', 'Enter OTP'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
      {steps.map((s, i) => (
        <div key={s} style={{
          height: 8,
          width:  i < idx ? 20 : 8,
          borderRadius: i < idx ? 4 : '50%',
          background: i < idx ? '#2dd4bf' : i === idx ? '#4f8bff' : 'rgba(255,255,255,0.15)',
          transition: 'all 0.3s',
        }} />
      ))}
      <span style={{ fontSize: 12, color: '#5a6480', marginLeft: 4 }}>
        {labels[Math.max(0, idx)] ?? ''}
      </span>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { setLoginResult } = useErpAuth();

  const [step,            setStep]            = useState<Step>('credentials');
  const [loginField,      setLoginField]       = useState('');
  const [password,        setPassword]         = useState('');
  const [showPass,        setShowPass]         = useState(false);
  const [channels,        setChannels]         = useState<OtpChannel[]>([]);
  const [selectedChannel, setSelectedChannel]  = useState<'email' | 'sms' | null>(null);
  const [maskedContact,   setMaskedContact]    = useState('');
  const [otp,             setOtp]              = useState(['', '', '', '', '', '']);
  const [loading,         setLoading]          = useState(false);
  const [resending,       setResending]        = useState(false);
  const [error,           setError]            = useState('');
  const [matchedSystems,  setMatchedSystems]   = useState<MatchedSystem[]>([]);
  const [erpToken,        setErpTokenState]     = useState('');
  const [redirectTarget,  setRedirectTarget]   = useState<MatchedSystem | null>(null);
  const [countdown,       setCountdown]        = useState(3);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'credentials') inputRef.current?.focus();
  }, [step]);

  // Auto-countdown for single system redirect
  useEffect(() => {
    if (step !== 'redirecting' || !redirectTarget) return;
    if (countdown <= 0) { redirectToSystem(redirectTarget); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, countdown, redirectTarget]);

  const err = (msg: string) => { setError(msg); setLoading(false); };

  // ── Step 1: Validate credentials ──────────────────────────────────────────
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginField.trim() || !password) { setError('Please fill in all fields.'); return; }
    setError(''); setLoading(true);

    try {
      const { data } = await authApi.validateCredentials(loginField.trim(), password);

      if (!data.status) {
        if (data.must_change_password) {
          // Skip OTP — direct login then fan-out
          const res = await authApi.directLogin(loginField.trim(), password);
          handleLoginResult(res.data);
          return;
        }
        return err(data.message || 'Invalid credentials.');
      }

      setChannels(data.channels ?? []);
      setStep('channel');
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Unable to reach the server.';
      err(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async (channel: 'email' | 'sms') => {
    setSelectedChannel(channel); setError(''); setLoading(true);
    try {
      const { data } = await authApi.sendOtp(loginField.trim(), channel);
      setMaskedContact(data.maskedContact);
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
    } catch (e: any) {
      err(e.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Verify OTP → fan-out ─────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Enter the complete 6-digit code.'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await authApi.verifyOtp(loginField.trim(), code);
      handleLoginResult(data);
    } catch (e: any) {
      err(e.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Post-login handler (shared by OTP verify + direct login) ──────────────
  const handleLoginResult = (data: any) => {
    if (!data.status || !data.matchedSystems?.length) {
      err('No systems found for your account. Contact your administrator.');
      return;
    }

    setLoginResult(data.erpToken, data.matchedSystems);
    setErpTokenState(data.erpToken);
    setMatchedSystems(data.matchedSystems);

    if (data.matchedSystems.length === 1) {
      // Single system — auto redirect
      setRedirectTarget(data.matchedSystems[0]);
      setCountdown(3);
      setStep('redirecting');
    } else {
      // Multiple systems — show picker
      setStep('systems');
    }
    setLoading(false);
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!selectedChannel) return;
    setResending(true); setError('');
    try {
      const { data } = await authApi.sendOtp(loginField.trim(), selectedChannel);
      setMaskedContact(data.maskedContact);
      setOtp(['', '', '', '', '', '']);
    } catch { /* silent */ }
    finally { setResending(false); }
  };

  // ── OTP input management ──────────────────────────────────────────────────
  const otpInput = (val: string, idx: number) => {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[idx] = v; setOtp(next);
    if (v && idx < 5) (document.getElementById(`otp-${idx + 1}`) as HTMLInputElement)?.focus();
  };

  const otpKey = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      const next = [...otp]; next[idx - 1] = ''; setOtp(next);
      (document.getElementById(`otp-${idx - 1}`) as HTMLInputElement)?.focus();
    }
  };

  const otpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const chars = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    const next = [...otp];
    chars.forEach((c, i) => { next[i] = c; });
    setOtp(next);
    (document.getElementById(`otp-${Math.min(chars.length, 5)}`) as HTMLInputElement)?.focus();
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const fieldStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 40px 0 14px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#e6edf3', fontFamily: 'inherit', fontSize: 14, outline: 'none',
  };

  const btnStyle: React.CSSProperties = {
    width: '100%', height: 44, borderRadius: 8, border: 'none',
    background: '#4f8bff', color: '#fff', fontFamily: 'inherit',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8,
    opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 500,
    color: '#8892ab', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.5px',
  };

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pop { 0% { transform:scale(0.5); opacity:0; } 70% { transform:scale(1.1); } 100% { transform:scale(1); opacity:1; } }
        .anim { animation: fadeUp 0.3s ease both; }
        .field-input:focus { border-color: #4f8bff !important; box-shadow: 0 0 0 3px rgba(79,139,255,0.15); }
        .channel-btn:hover { border-color: #4f8bff !important; background: rgba(79,139,255,0.08) !important; }
        .sys-card:hover { border-color: rgba(255,255,255,0.2) !important; transform: translateY(-2px); }
        .otp-inp { text-align:center; font-size:22px; font-weight:700; padding:0 !important; }
        .otp-inp:focus { border-color: #4f8bff !important; box-shadow: 0 0 0 3px rgba(79,139,255,0.15); }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>

        {/* Grid background */}
        <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(79,139,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(79,139,255,0.03) 1px,transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

        {/* Ambient glow */}
        <div style={{ position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse,rgba(79,139,255,0.07) 0%,transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 36, animation: 'fadeUp 0.5s ease both' }}>
            <div style={{
              width: 60, height: 60, borderRadius: 16, margin: '0 auto 18px',
              background: 'rgba(79,139,255,0.12)', border: '1px solid rgba(79,139,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 700, color: '#4f8bff',
            }}>⬡</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', margin: '0 0 8px' }}>
              ERP Access Portal
            </h1>
            <p style={{ fontSize: 14, color: '#8892ab', margin: 0 }}>
              Tanzania Port Authority — Unified System Login
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: 32, animation: 'fadeUp 0.5s 0.1s ease both',
          }}>

            {/* ── CREDENTIALS ────────────────────────────────────────────── */}
            {step === 'credentials' && (
              <div className="anim">
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Sign in</h2>
                  <p style={{ fontSize: 13, color: '#8892ab', margin: 0 }}>Enter your credentials to continue</p>
                </div>

                {error && <Alert msg={error} />}

                <form onSubmit={handleCredentials}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Username or Email</label>
                    <input
                      ref={inputRef}
                      className="field-input"
                      style={fieldStyle}
                      placeholder="Enter username or email"
                      value={loginField}
                      onChange={(e) => setLoginField(e.target.value)}
                      autoComplete="username"
                    />
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="field-input"
                        style={fieldStyle}
                        type={showPass ? 'text' : 'password'}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((s) => !s)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#5a6480', cursor: 'pointer', display: 'flex' }}
                      >
                        <EyeIcon open={showPass} />
                      </button>
                    </div>
                  </div>

                  <button type="submit" style={btnStyle} disabled={loading || !loginField || !password}>
                    {loading ? <Spinner /> : <>Continue <span>→</span></>}
                  </button>
                </form>
              </div>
            )}

            {/* ── OTP CHANNEL ──────────────────────────────────────────────── */}
            {step === 'channel' && (
              <div className="anim">
                <StepDots steps={['credentials', 'channel', 'otp']} current="channel" />

                <button onClick={() => { setStep('credentials'); setError(''); }} style={{ background: 'none', border: 'none', color: '#5a6480', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, padding: 0, marginBottom: 18 }}>
                  ← Back
                </button>

                <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Choose verification method</h2>
                <p style={{ fontSize: 13, color: '#8892ab', margin: '0 0 20px' }}>How would you like to receive your OTP?</p>

                {error && <Alert msg={error} />}

                {channels.map((ch) => (
                  <button
                    key={ch.type}
                    className="channel-btn"
                    onClick={() => handleSendOtp(ch.type)}
                    disabled={loading}
                    style={{
                      width: '100%', padding: '14px 16px', marginBottom: 10,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, color: '#e6edf3', fontFamily: 'inherit', fontSize: 14,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                      textAlign: 'left', transition: 'border-color 0.2s, background 0.2s',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(79,139,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {ch.type === 'email' ? '✉️' : '📱'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{ch.label}</div>
                      <div style={{ fontSize: 12, color: '#8892ab' }}>{ch.display}</div>
                    </div>
                    {loading && selectedChannel === ch.type && <div style={{ marginLeft: 'auto' }}><Spinner color="blue" /></div>}
                  </button>
                ))}
              </div>
            )}

            {/* ── OTP VERIFY ───────────────────────────────────────────────── */}
            {step === 'otp' && (
              <div className="anim">
                <StepDots steps={['credentials', 'channel', 'otp']} current="otp" />

                <button onClick={() => { setStep('channel'); setError(''); setOtp(['','','','','','']); }} style={{ background: 'none', border: 'none', color: '#5a6480', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, padding: 0, marginBottom: 18 }}>
                  ← Change method
                </button>

                <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Verification code</h2>
                <p style={{ fontSize: 13, color: '#8892ab', margin: '0 0 20px' }}>
                  Sent to <strong style={{ color: '#e6edf3' }}>{maskedContact}</strong>
                </p>

                {error && <Alert msg={error} />}

                <form onSubmit={handleVerifyOtp}>
                  <label style={labelStyle}>6-digit security code</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    {otp.map((d, i) => (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        className="field-input otp-inp"
                        style={{ ...fieldStyle, flex: 1, height: 52 }}
                        onChange={(e) => otpInput(e.target.value, i)}
                        onKeyDown={(e) => otpKey(e, i)}
                        onPaste={otpPaste}
                        autoComplete="one-time-code"
                      />
                    ))}
                  </div>

                  <button type="submit" style={btnStyle} disabled={loading || otp.join('').length < 6}>
                    {loading ? <Spinner /> : 'Verify & Sign In'}
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 13 }}>
                    <span style={{ color: '#5a6480' }}>Didn't receive it?</span>
                    <button type="button" onClick={handleResend} disabled={resending} style={{ background: 'none', border: 'none', color: '#4f8bff', cursor: 'pointer', fontFamily: 'inherit', padding: 0, opacity: resending ? 0.5 : 1 }}>
                      {resending ? 'Sending…' : 'Resend code'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── SYSTEM PICKER ────────────────────────────────────────────── */}
            {step === 'systems' && (
              <div className="anim">
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Choose a system</h2>
                <p style={{ fontSize: 13, color: '#8892ab', margin: '0 0 20px' }}>
                  Your account was found in {matchedSystems.length} systems. Select one to continue.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {matchedSystems.map((sys) => (
                    <button
                      key={sys.profile.id}
                      className="sys-card"
                      onClick={() => redirectToSystem(sys)}
                      style={{
                        width: '100%', padding: '16px 18px',
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12, color: '#e6edf3', fontFamily: 'inherit',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                        textAlign: 'left', transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(79,139,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        {sys.profile.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{sys.profile.name}</div>
                        {sys.profile.description && (
                          <div style={{ fontSize: 12, color: '#8892ab', marginTop: 2 }}>{sys.profile.description}</div>
                        )}
                        <div style={{ fontSize: 12, color: '#5a6480', marginTop: 4, fontFamily: 'DM Mono, monospace' }}>
                          {sys.profile.app_url}
                        </div>
                      </div>
                      <span style={{ color: '#5a6480', fontSize: 18 }}>→</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── REDIRECTING ──────────────────────────────────────────────── */}
            {step === 'redirecting' && redirectTarget && (
              <div className="anim" style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px', background: 'rgba(45,212,191,0.1)', border: '2px solid rgba(45,212,191,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, animation: 'pop 0.4s ease both' }}>
                  ✓
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: '#2dd4bf' }}>Signed in successfully</h2>
                <p style={{ fontSize: 14, color: '#8892ab', margin: '0 0 16px' }}>
                  Redirecting to <strong style={{ color: '#e6edf3' }}>{redirectTarget.profile.name}</strong>
                </p>
                <div style={{ fontSize: 13, color: '#5a6480' }}>in {countdown}s…</div>
                <button
                  onClick={() => redirectToSystem(redirectTarget)}
                  style={{ ...btnStyle, marginTop: 20, background: 'rgba(45,212,191,0.15)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)' }}
                >
                  Go now →
                </button>
              </div>
            )}

          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#3a4255', marginTop: 20 }}>
            Tanzania Port Authority © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </>
  );
}
