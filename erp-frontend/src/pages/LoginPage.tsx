import { useState, useRef, useEffect } from 'react';
import {
  Eye, EyeOff, ArrowRight, ArrowLeft, Mail, Phone,
  Loader2, ShieldCheck, CheckCircle, ChevronRight,
  Monitor, AlertCircle,
} from 'lucide-react';
import { authApi } from '../api/auth';
import { useErpAuth } from '../store/authStore';
import type { OtpChannel, MatchedSystem } from '../types';

type Step = 'credentials' | 'channel' | 'otp' | 'systems' | 'redirecting';

// ── Brand tokens ──────────────────────────────────────────────────────────
const B = {
  brand500:  '#465fff',
  brand600:  '#3641f5',
  brand400:  '#7592ff',
  gray950:   '#0c111d',
  gray900:   '#101828',
  gray800:   '#1d2939',
  gray700:   '#344054',
  gray600:   '#475467',
  gray500:   '#667085',
  gray400:   '#98a2b3',
  gray300:   '#d0d5dd',
  gray200:   '#e4e7ec',
  gray100:   '#f2f4f7',
  gray50:    '#f9fafb',
  success:   '#12b76a',
  error:     '#f04438',
};

// ── System icon map ───────────────────────────────────────────────────────
// Reads the icon string stored in software_profiles.icon (lucide icon name).
// Add more mappings here as new profiles are created.
const ICON_MAP: Record<string, React.ReactNode> = {
  'shield-check':     <ShieldCheck size={22} />,
  'container':        <Monitor size={22} />,
  'layout-dashboard': <Monitor size={22} />,
  'building-2':       <Monitor size={22} />,
  'monitor':          <Monitor size={22} />,
};

const SystemIcon = ({ icon }: { icon: string }) =>
  <>{ICON_MAP[icon] ?? <Monitor size={22} />}</>;

// ── Redirect helper ───────────────────────────────────────────────────────
const redirectToSystem = (system: MatchedSystem) => {
  const token        = system.tokens.access?.token  ?? '';
  const refreshToken = system.tokens.refresh?.token ?? '';
  localStorage.setItem('access_token',  token);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('tpfcs_user',    JSON.stringify(system.user));
  const url = new URL(system.profile.app_url);
  if (token)        url.searchParams.set('token',        token);
  if (refreshToken) url.searchParams.set('refreshToken', refreshToken);
  window.location.href = url.toString();
};

// ── Shared styles ─────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', height: 44,
  padding: '0 42px 0 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, color: B.gray50,
  fontFamily: 'Outfit, sans-serif',
  fontSize: 14, outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500,
  color: B.gray300, marginBottom: 7,
};

const primaryBtn: React.CSSProperties = {
  width: '100%', height: 44,
  background: B.brand500,
  border: 'none', borderRadius: 10,
  color: '#fff', fontFamily: 'Outfit, sans-serif',
  fontSize: 14, fontWeight: 600,
  cursor: 'pointer', marginTop: 8,
  display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: 8,
  transition: 'background 0.2s, opacity 0.2s',
};

// ── Small components ──────────────────────────────────────────────────────
const Spin = ({ size = 18 }: { size?: number }) => (
  <Loader2 size={size} style={{ animation: 'erp-spin 0.8s linear infinite', flexShrink: 0 }} />
);

const Alert = ({ msg }: { msg: string }) => (
  <div style={{
    display: 'flex', gap: 10, alignItems: 'flex-start',
    padding: '11px 14px', borderRadius: 10, marginBottom: 18,
    background: 'rgba(240,68,56,0.08)',
    border: '1px solid rgba(240,68,56,0.22)',
    color: '#fda29b', fontSize: 13, lineHeight: 1.5,
  }}>
    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
    <span>{msg}</span>
  </div>
);

const StepDots = ({ current }: { current: Step }) => {
  const steps  = ['credentials', 'channel', 'otp'];
  const idx    = steps.indexOf(current);
  const labels = ['Enter credentials', 'Choose delivery method', 'Enter OTP'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 22 }}>
      {steps.map((_, i) => (
        <div key={i} style={{
          height: 6, width: i < idx ? 18 : 6,
          borderRadius: i < idx ? 3 : '50%',
          background: i < idx ? B.success : i === idx ? B.brand500 : 'rgba(255,255,255,0.15)',
          transition: 'all 0.3s',
        }} />
      ))}
      <span style={{ fontSize: 12, color: B.gray500, marginLeft: 4 }}>
        {labels[Math.max(0, idx)] ?? ''}
      </span>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────
export default function LoginPage() {
  const { setLoginResult } = useErpAuth();

  const [step,            setStep]          = useState<Step>('credentials');
  const [loginField,      setLoginField]    = useState('');
  const [password,        setPassword]      = useState('');
  const [showPass,        setShowPass]      = useState(false);
  const [channels,        setChannels]      = useState<OtpChannel[]>([]);
  const [selectedChannel, setSelChannel]    = useState<'email' | 'sms' | null>(null);
  const [maskedContact,   setMasked]        = useState('');
  const [otp,             setOtp]           = useState(['','','','','','']);
  const [loading,         setLoading]       = useState(false);
  const [resending,       setResending]     = useState(false);
  const [error,           setError]         = useState('');
  const [matchedSystems,  setMatched]       = useState<MatchedSystem[]>([]);
  const [redirectTarget,  setRedirectTarget]= useState<MatchedSystem | null>(null);
  const [countdown,       setCountdown]     = useState(3);
  const [channelLoading,  setChLoading]     = useState<string | null>(null);

  const loginRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (step === 'credentials') loginRef.current?.focus(); }, [step]);

  useEffect(() => {
    if (step !== 'redirecting' || !redirectTarget) return;
    if (countdown <= 0) { redirectToSystem(redirectTarget); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, countdown, redirectTarget]);

  const err = (msg: string) => { setError(msg); setLoading(false); setChLoading(null); };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginField.trim() || !password) { setError('Please fill in all fields.'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await authApi.validateCredentials(loginField.trim(), password);
      if (!data.status) {
        if (data.must_change_password) {
          const res = await authApi.directLogin(loginField.trim(), password);
          handleLoginResult(res.data); return;
        }
        return err(data.message || 'Invalid credentials.');
      }
      setChannels(data.channels ?? []);
      setStep('channel');
    } catch (e: any) {
      err(e.response?.data?.message || 'Unable to reach the server. Please check your connection.');
    } finally { setLoading(false); }
  };

  const handleSendOtp = async (channel: 'email' | 'sms') => {
    setSelChannel(channel); setError(''); setChLoading(channel);
    try {
      const { data } = await authApi.sendOtp(loginField.trim(), channel);
      setMasked(data.maskedContact);
      setOtp(['','','','','','']);
      setStep('otp');
    } catch (e: any) {
      err(e.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally { setChLoading(null); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter the complete 6-digit code.'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await authApi.verifyOtp(loginField.trim(), code);
      handleLoginResult(data);
    } catch (e: any) {
      err(e.response?.data?.message || 'Invalid or expired OTP. Please request a new one.');
    } finally { setLoading(false); }
  };

  const handleLoginResult = (data: any) => {
    if (!data.status || !data.matchedSystems?.length) {
      err('No systems found for your account. Contact your administrator.');
      return;
    }
    setLoginResult(data.erpToken, data.matchedSystems);
    setMatched(data.matchedSystems);
    if (data.matchedSystems.length === 1) {
      setRedirectTarget(data.matchedSystems[0]);
      setCountdown(3);
      setStep('redirecting');
    } else {
      setStep('systems');
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (!selectedChannel) return;
    setResending(true); setError('');
    try {
      const { data } = await authApi.sendOtp(loginField.trim(), selectedChannel);
      setMasked(data.maskedContact);
      setOtp(['','','','','','']);
    } catch { /* silent */ }
    finally { setResending(false); }
  };

  const otpInput = (val: string, idx: number) => {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[idx] = v; setOtp(next);
    if (v && idx < 5) (document.getElementById(`otp-${idx+1}`) as HTMLInputElement)?.focus();
  };
  const otpKey = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      const next = [...otp]; next[idx-1] = ''; setOtp(next);
      (document.getElementById(`otp-${idx-1}`) as HTMLInputElement)?.focus();
    }
  };
  const otpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const chars = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6).split('');
    const next = [...otp]; chars.forEach((c,i) => { next[i] = c; }); setOtp(next);
    (document.getElementById(`otp-${Math.min(chars.length,5)}`) as HTMLInputElement)?.focus();
  };

  return (
    <>
      <style>{`
        @keyframes erp-spin   { to { transform: rotate(360deg); } }
        @keyframes erp-fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes erp-pop    { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        .erp-anim    { animation: erp-fadeUp 0.3s ease both; }
        .erp-inp:focus  { border-color: ${B.brand500} !important; box-shadow: 0 0 0 4px rgba(70,95,255,0.12); }
        .erp-channel:hover { border-color: ${B.brand500} !important; background: rgba(70,95,255,0.07) !important; }
        .erp-sys:hover   { border-color: rgba(70,95,255,0.45) !important; background: rgba(70,95,255,0.05) !important; transform: translateY(-1px); }
        .erp-pbtn:hover  { background: ${B.brand600} !important; }
        .erp-pbtn:disabled { opacity: 0.5 !important; cursor: not-allowed; }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', background: B.gray950 }}>

        {/* ── LEFT — branding panel (lg+) ───────────────────────────────── */}
        <div style={{
          display: 'none', width: '44%', flexShrink: 0,
          background: `linear-gradient(150deg, #0d1526 0%, #101828 50%, #0f1d3a 100%)`,
          borderRight: '1px solid rgba(70,95,255,0.12)',
          flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '48px 40px',
        }} id="erp-left">

          {/* Badge */}
          <img
            src="/logo-256.png"
            alt="Tanzania Police Force"
            style={{ width: 140, height: 140, objectFit: 'contain', marginBottom: 28, filter: 'drop-shadow(0 4px 24px rgba(70,95,255,0.3))' }}
          />

          <h2 style={{ fontSize: 20, fontWeight: 700, color: B.gray50, margin: '0 0 8px', textAlign: 'center', letterSpacing: '-0.2px' }}>
            Tanzania Police Force Corporation Sole (TPFCS)
          </h2>
          <p style={{ fontSize: 13, color: B.gray500, textAlign: 'center', lineHeight: 1.7, maxWidth: 260, margin: '0 0 48px' }}>
            Unified ERP access portal — single sign-on across all TPFCS management systems
          </p>

          {/* System list */}
          <div style={{ width: '100%', maxWidth: 280 }}>
            <p style={{ fontSize: 11, color: B.gray700, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, marginBottom: 12 }}>
              Connected Systems
            </p>
            {[
              { icon: <ShieldCheck size={16} />, label: 'URA Security System' },
              { icon: <Monitor size={16} />,     label: 'ICDV Management' },
              { icon: <Monitor size={16} />,     label: 'Project Management' },
              { icon: <Monitor size={16} />,     label: 'Management System' },
            ].map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', marginBottom: 6,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 8,
              }}>
                <span style={{ color: B.brand400, flexShrink: 0 }}>{s.icon}</span>
                <span style={{ fontSize: 13, color: B.gray400 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT — login form ─────────────────────────────────────────── */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '32px 24px',
          position: 'relative', overflow: 'hidden',
        }}>

          {/* Subtle glow */}
          <div style={{ position: 'fixed', top: -160, right: -160, width: 480, height: 480, background: 'radial-gradient(circle, rgba(70,95,255,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>

            {/* Branding header */}
            <div style={{ textAlign: 'center', marginBottom: 28, animation: 'erp-fadeUp 0.4s ease both' }}>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: B.gray50, margin: '0 0 4px', letterSpacing: '-0.1px' }}>
                ERP Access Portal
              </h1>
              <p style={{ fontSize: 12, color: B.gray600, margin: 0 }}>
                Tanzania Police Force Corporation Sole
              </p>
            </div>

            {/* Card */}
            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: 32,
              animation: 'erp-fadeUp 0.45s ease both',
              backdropFilter: 'blur(6px)',
            }}>

              {/* ── CREDENTIALS ─────────────────────────────────────────── */}
              {step === 'credentials' && (
                <div className="erp-anim">
                  <p style={{ fontSize: 16, fontWeight: 700, color: B.gray50, margin: '0 0 4px', letterSpacing: '-0.2px' }}>
                    Sign in to your account
                  </p>
                  <p style={{ fontSize: 13, color: B.gray500, margin: '0 0 24px' }}>
                    Enter your credentials to continue
                  </p>

                  {error && <Alert msg={error} />}

                  <form onSubmit={handleCredentials}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={lbl}>Username or Email</label>
                      <input
                        ref={loginRef}
                        className="erp-inp"
                        style={inp}
                        placeholder="Enter username or email"
                        value={loginField}
                        onChange={e => setLoginField(e.target.value)}
                        autoComplete="username"
                      />
                    </div>

                    <div style={{ marginBottom: 6 }}>
                      <label style={lbl}>Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          className="erp-inp"
                          style={inp}
                          type={showPass ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(s => !s)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: B.gray500, cursor: 'pointer', display: 'flex', padding: 4 }}
                        >
                          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="erp-pbtn"
                      style={primaryBtn}
                      disabled={loading || !loginField.trim() || !password}
                    >
                      {loading ? <Spin /> : <><span>Continue</span><ArrowRight size={16} /></>}
                    </button>
                  </form>
                </div>
              )}

              {/* ── CHANNEL ─────────────────────────────────────────────── */}
              {step === 'channel' && (
                <div className="erp-anim">
                  <StepDots current="channel" />

                  <button
                    onClick={() => { setStep('credentials'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: B.gray500, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, padding: 0, marginBottom: 20, fontFamily: 'Outfit, sans-serif' }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>

                  <p style={{ fontSize: 16, fontWeight: 700, color: B.gray50, margin: '0 0 4px' }}>Two-step verification</p>
                  <p style={{ fontSize: 13, color: B.gray500, margin: '0 0 20px' }}>Choose how to receive your one-time code</p>

                  {error && <Alert msg={error} />}

                  {channels.map(ch => (
                    <button
                      key={ch.type}
                      className="erp-channel"
                      onClick={() => handleSendOtp(ch.type)}
                      disabled={!!channelLoading}
                      style={{
                        width: '100%', padding: '14px 16px', marginBottom: 10,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 12, color: B.gray100,
                        fontFamily: 'Outfit, sans-serif', fontSize: 14,
                        cursor: 'pointer', display: 'flex',
                        alignItems: 'center', gap: 14, textAlign: 'left',
                        transition: 'border-color 0.2s, background 0.2s',
                        opacity: channelLoading && channelLoading !== ch.type ? 0.5 : 1,
                      }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(70,95,255,0.12)', border: '1px solid rgba(70,95,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: B.brand400, flexShrink: 0 }}>
                        {ch.type === 'email' ? <Mail size={18} /> : <Phone size={18} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{ch.label}</div>
                        <div style={{ fontSize: 12, color: B.gray500 }}>{ch.display}</div>
                      </div>
                      {channelLoading === ch.type
                        ? <Spin size={16} />
                        : <ChevronRight size={16} style={{ color: B.gray600, flexShrink: 0 }} />
                      }
                    </button>
                  ))}
                </div>
              )}

              {/* ── OTP ─────────────────────────────────────────────────── */}
              {step === 'otp' && (
                <div className="erp-anim">
                  <StepDots current="otp" />

                  <button
                    onClick={() => { setStep('channel'); setError(''); setOtp(['','','','','','']); }}
                    style={{ background: 'none', border: 'none', color: B.gray500, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, padding: 0, marginBottom: 20, fontFamily: 'Outfit, sans-serif' }}
                  >
                    <ArrowLeft size={14} /> Change method
                  </button>

                  <p style={{ fontSize: 16, fontWeight: 700, color: B.gray50, margin: '0 0 4px' }}>Enter verification code</p>
                  <p style={{ fontSize: 13, color: B.gray500, margin: '0 0 22px' }}>
                    Code sent to <strong style={{ color: B.gray300 }}>{maskedContact}</strong>
                  </p>

                  {error && <Alert msg={error} />}

                  <form onSubmit={handleVerifyOtp}>
                    <label style={lbl}>6-digit security code</label>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
                      {otp.map((d, i) => (
                        <input
                          key={i}
                          id={`otp-${i}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={d}
                          className="erp-inp"
                          style={{ ...inp, flex: 1, height: 54, padding: 0, textAlign: 'center', fontSize: 22, fontWeight: 700 }}
                          onChange={e => otpInput(e.target.value, i)}
                          onKeyDown={e => otpKey(e, i)}
                          onPaste={otpPaste}
                          autoComplete="one-time-code"
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      className="erp-pbtn"
                      style={primaryBtn}
                      disabled={loading || otp.join('').length < 6}
                    >
                      {loading ? <Spin /> : <><span>Verify &amp; Sign In</span><ShieldCheck size={16} /></>}
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 13 }}>
                      <span style={{ color: B.gray600 }}>Didn't receive a code?</span>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        style={{ background: 'none', border: 'none', color: B.brand500, fontFamily: 'Outfit, sans-serif', fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, opacity: resending ? 0.5 : 1 }}
                      >
                        {resending ? <><Spin size={13} /> Sending…</> : 'Resend code'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── SYSTEM PICKER ───────────────────────────────────────── */}
              {step === 'systems' && (
                <div className="erp-anim">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 14px', background: 'rgba(18,183,106,0.07)', border: '1px solid rgba(18,183,106,0.2)', borderRadius: 10 }}>
                    <CheckCircle size={20} style={{ color: B.success, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: B.gray100, margin: 0 }}>Authentication successful</p>
                      <p style={{ fontSize: 12, color: B.gray500, margin: 0 }}>
                        Found in {matchedSystems.length} system{matchedSystems.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: B.gray400, margin: '0 0 14px' }}>Select a system to continue</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {matchedSystems.map(sys => (
                      <button
                        key={sys.profile.id}
                        className="erp-sys"
                        onClick={() => redirectToSystem(sys)}
                        style={{
                          width: '100%', padding: '14px 16px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 12, color: B.gray100,
                          fontFamily: 'Outfit, sans-serif',
                          cursor: 'pointer', display: 'flex',
                          alignItems: 'center', gap: 14,
                          textAlign: 'left', transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(70,95,255,0.1)', border: '1px solid rgba(70,95,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: B.brand400, flexShrink: 0 }}>
                          <SystemIcon icon={sys.profile.icon} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{sys.profile.name}</div>
                          {sys.profile.description && (
                            <div style={{ fontSize: 12, color: B.gray500 }}>{sys.profile.description}</div>
                          )}
                        </div>
                        <ChevronRight size={16} style={{ color: B.gray600, flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── REDIRECTING ─────────────────────────────────────────── */}
              {step === 'redirecting' && redirectTarget && (
                <div className="erp-anim" style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 18px', background: 'rgba(18,183,106,0.1)', border: '2px solid rgba(18,183,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'erp-pop 0.4s ease both' }}>
                    <CheckCircle size={30} style={{ color: B.success }} />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: B.gray50, margin: '0 0 8px' }}>Signed in successfully</p>
                  <p style={{ fontSize: 13, color: B.gray500, margin: '0 0 4px' }}>
                    Redirecting to <strong style={{ color: B.gray300 }}>{redirectTarget.profile.name}</strong>
                  </p>
                  <p style={{ fontSize: 13, color: B.gray700, margin: '0 0 24px' }}>in {countdown}s</p>

                  <button
                    onClick={() => redirectToSystem(redirectTarget)}
                    className="erp-pbtn"
                    style={{ ...primaryBtn, marginTop: 0, background: 'rgba(18,183,106,0.12)', color: B.success, border: '1px solid rgba(18,183,106,0.28)' }}
                  >
                    <span>Go now</span><ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <p style={{ textAlign: 'center', fontSize: 12, color: B.gray700, marginTop: 22 }}>
              Tanzania Police Force Corporation Sole (TPFCS) © {new Date().getFullYear()}
            </p>
          </div>
        </div>

        <style>{`@media (min-width: 1024px) { #erp-left { display: flex !important; } }`}</style>
      </div>
    </>
  );
}
