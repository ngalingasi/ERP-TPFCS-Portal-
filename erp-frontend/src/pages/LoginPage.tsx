import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Eye, EyeOff, ArrowRight, ArrowLeft, Mail, Phone,
  Loader2, ShieldCheck, CheckCircle, ChevronRight,
  Monitor, AlertCircle, Building2,
} from 'lucide-react';
import { authApi } from '../api/auth';
import { useErpAuth } from '../store/authStore';
import type { OtpChannel, MatchedSystem } from '../types';

type Step = 'credentials' | 'channel' | 'otp' | 'systems' | 'redirecting';

const B = {
  brand500: '#465fff', brand600: '#3641f5', brand400: '#7592ff',
  brand900: '#1a2560', brand950: '#0f1540',
  gray950: '#0c111d', gray900: '#101828', gray800: '#1d2939',
  gray700: '#344054', gray600: '#475467', gray500: '#667085',
  gray400: '#98a2b3', gray300: '#d0d5dd', gray200: '#e4e7ec',
  gray100: '#f2f4f7', gray50: '#f9fafb',
  success: '#12b76a', error: '#f04438',
};

const SYSTEMS_LIST = [
  { icon: <ShieldCheck size={15} />, label: 'URA Security System' },
  { icon: <Monitor size={15} />,     label: 'ICDV Management' },
  { icon: <Monitor size={15} />,     label: 'Project Management' },
  { icon: <Building2 size={15} />,   label: 'Management System' },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  'shield-check':     <ShieldCheck size={20} />,
  'container':        <Monitor size={20} />,
  'layout-dashboard': <Monitor size={20} />,
  'building-2':       <Building2 size={20} />,
  'monitor':          <Monitor size={20} />,
};

const SystemIcon = ({ icon, size = 20 }: { icon: string; size?: number }) => {
  const map: Record<string, React.ReactNode> = {
    'shield-check':     <ShieldCheck size={size} />,
    'container':        <Monitor size={size} />,
    'layout-dashboard': <Monitor size={size} />,
    'building-2':       <Building2 size={size} />,
    'monitor':          <Monitor size={size} />,
  };
  return <>{map[icon] ?? <Monitor size={size} />}</>;
};

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

// ── Shared input style (light card) ──────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', height: 46,
  padding: '0 42px 0 14px',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 10, color: '#1e293b',
  fontFamily: 'Outfit, sans-serif',
  fontSize: 14, outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500,
  color: '#475569', marginBottom: 7,
};

const primaryBtn: React.CSSProperties = {
  width: '100%', height: 46,
  background: B.brand500,
  border: 'none', borderRadius: 10,
  color: '#fff', fontFamily: 'Outfit, sans-serif',
  fontSize: 14, fontWeight: 600,
  cursor: 'pointer', marginTop: 8,
  display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: 8,
  transition: 'background 0.2s, opacity 0.2s',
};

const Spin = ({ size = 18 }: { size?: number }) => (
  <Loader2 size={size} style={{ animation: 'erp-spin 0.8s linear infinite', flexShrink: 0 }} />
);

const Alert = ({ msg }: { msg: string }) => (
  <div style={{
    display: 'flex', gap: 10, alignItems: 'flex-start',
    padding: '11px 14px', borderRadius: 10, marginBottom: 18,
    background: 'rgba(240,68,56,0.06)',
    border: '1px solid rgba(240,68,56,0.2)',
    color: '#dc2626', fontSize: 13, lineHeight: 1.5,
  }}>
    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
    <span>{msg}</span>
  </div>
);

const StepDots = ({ current }: { current: Step }) => {
  const steps  = ['credentials', 'channel', 'otp'];
  const idx    = steps.indexOf(current);
  const labels = ['Credentials', 'Choose method', 'Verify code'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
      {steps.map((_, i) => (
        <div key={i} style={{
          height: 5, width: i < idx ? 16 : 5,
          borderRadius: i < idx ? 3 : '50%',
          background: i < idx ? B.success : i === idx ? B.brand500 : '#cbd5e1',
          transition: 'all 0.3s',
        }} />
      ))}
      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>
        {labels[Math.max(0, idx)] ?? ''}
      </span>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { setLoginResult } = useErpAuth();
  const navigate = useNavigate();

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

  useEffect(() => { if (step === 'credentials') setTimeout(() => loginRef.current?.focus(), 100); }, [step]);

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
      setCountdown(3); setStep('redirecting');
    } else {
      navigate('/dashboard');
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
        @keyframes erp-fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes erp-pop    { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        .erp-anim  { animation: erp-fadeUp 0.32s ease both; }
        .erp-inp:focus  { border-color: ${B.brand500} !important; box-shadow: 0 0 0 3px rgba(70,95,255,0.1) !important; background: #fff !important; }
        .erp-pbtn:hover { background: ${B.brand600} !important; }
        .erp-pbtn:disabled { opacity: 0.5 !important; cursor: not-allowed; }
        .erp-channel:hover { border-color: ${B.brand500} !important; background: #f0f4ff !important; }
        .erp-sys:hover { border-color: ${B.brand500} !important; box-shadow: 0 2px 12px rgba(70,95,255,0.12); transform: translateY(-1px); }
        .erp-back:hover { color: #334155 !important; }
      `}</style>

      {/* ── Full-screen background ─────────────────────────────────────────── */}
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Outfit, sans-serif',
      }}>

        {/* Deep branded background with geometric shapes */}
        <div style={{
          position: 'fixed', inset: 0,
          background: `linear-gradient(135deg, #0a0f2e 0%, #0f1a4a 30%, #1a2560 55%, #0d1535 80%, #060d20 100%)`,
          zIndex: 0,
        }} />

        {/* Geometric overlay shapes */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
          {/* Large circle top-left */}
          <div style={{ position: 'absolute', top: -200, left: -200, width: 600, height: 600, borderRadius: '50%', background: 'rgba(70,95,255,0.08)', border: '1px solid rgba(70,95,255,0.12)' }} />
          {/* Medium circle bottom-left */}
          <div style={{ position: 'absolute', bottom: -100, left: 100, width: 350, height: 350, borderRadius: '50%', background: 'rgba(70,95,255,0.05)', border: '1px solid rgba(70,95,255,0.08)' }} />
          {/* Top-right accent */}
          <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(117,146,255,0.06)' }} />
          {/* Diagonal line accent */}
          <div style={{ position: 'absolute', top: 0, left: '38%', width: '1px', height: '100%', background: 'rgba(255,255,255,0.04)', transform: 'rotate(15deg)', transformOrigin: 'top' }} />
          {/* Grid dots */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        {/* ── LEFT — branding panel ──────────────────────────────────────────── */}
        <div id="erp-left" style={{
          position: 'relative', zIndex: 2,
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
          maxWidth: 560,
        }}>

          {/* Logo — centered, standalone */}
          <div style={{ textAlign: 'center' }}>
            <img src="/logo-256.png" alt="TPFCS" style={{ width: 110, height: 110, objectFit: 'contain', display: 'block', margin: '0 auto', filter: 'drop-shadow(0 4px 20px rgba(70,95,255,0.5))' }} />
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.1px' }}>TPFCS</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', lineHeight: 1.6, marginTop: 4, whiteSpace: 'nowrap' }}>Tanzania Police Force Corporation Sole</div>
            </div>
          </div>

          {/* Center content */}
          <div>

            <h1 style={{ fontSize: 42, fontWeight: 800, color: '#fff', margin: '0 0 16px', lineHeight: 1.15, letterSpacing: '-1px' }}>
              Your unified<br />
              <span style={{ color: B.brand400 }}>ERP gateway</span>
            </h1>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '0 0 40px', maxWidth: 340 }}>
              Single sign-on access to all TPFCS management systems. One login, every platform.
            </p>

            {/* Connected systems list */}
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: 14 }}>Connected systems</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SYSTEMS_LIST.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 10,
                    backdropFilter: 'blur(4px)',
                  }}>
                    <span style={{ color: B.brand400, flexShrink: 0 }}>{s.icon}</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{s.label}</span>
                    <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
            © {new Date().getFullYear()} Tanzania Police Force Corporation Sole
          </p>
        </div>

        {/* ── RIGHT — floating form card ─────────────────────────────────────── */}
        <div id="erp-right" style={{
          position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '32px 80px 32px 16px',
          flex: '0 0 auto', width: '100%', maxWidth: 800,
        }}>
          <div style={{
            width: '100%', maxWidth: 400,
            background: '#fff',
            borderRadius: 20,
            padding: '40px 36px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)',
            animation: 'erp-fadeUp 0.5s ease both',
          }}>

            {/* ── CREDENTIALS ─────────────────────────────────────────────── */}
            {step === 'credentials' && (
              <div className="erp-anim">
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
                  Welcome back
                </h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 28px' }}>
                  Sign in to access your systems
                </p>

                {error && <Alert msg={error} />}

                <form onSubmit={handleCredentials}>
                  <div style={{ marginBottom: 18 }}>
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
                      <button type="button" onClick={() => setShowPass(s => !s)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="erp-pbtn" style={primaryBtn}
                    disabled={loading || !loginField.trim() || !password}>
                    {loading ? <Spin /> : <><span>Sign In</span><ArrowRight size={16} /></>}
                  </button>
                </form>
              </div>
            )}

            {/* ── CHANNEL ─────────────────────────────────────────────────── */}
            {step === 'channel' && (
              <div className="erp-anim">
                <StepDots current="channel" />
                <button className="erp-back" onClick={() => { setStep('credentials'); setError(''); }}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, padding: 0, marginBottom: 20, fontFamily: 'Outfit, sans-serif' }}>
                  <ArrowLeft size={14} /> Back
                </button>

                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Verify your identity</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 22px' }}>Choose how to receive your one-time code</p>

                {error && <Alert msg={error} />}

                {channels.map(ch => (
                  <button key={ch.type} className="erp-channel" onClick={() => handleSendOtp(ch.type)}
                    disabled={!!channelLoading}
                    style={{
                      width: '100%', padding: '14px 16px', marginBottom: 10,
                      background: '#f8fafc', border: '1.5px solid #e2e8f0',
                      borderRadius: 12, color: '#1e293b', fontFamily: 'Outfit, sans-serif',
                      fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center',
                      gap: 14, textAlign: 'left', transition: 'all 0.18s',
                      opacity: channelLoading && channelLoading !== ch.type ? 0.5 : 1,
                    }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(70,95,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: B.brand500, flexShrink: 0 }}>
                      {ch.type === 'email' ? <Mail size={18} /> : <Phone size={18} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{ch.label}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{ch.display}</div>
                    </div>
                    {channelLoading === ch.type ? <Spin size={16} /> : <ChevronRight size={16} style={{ color: '#cbd5e1' }} />}
                  </button>
                ))}
              </div>
            )}

            {/* ── OTP ─────────────────────────────────────────────────────── */}
            {step === 'otp' && (
              <div className="erp-anim">
                <StepDots current="otp" />
                <button className="erp-back" onClick={() => { setStep('channel'); setError(''); setOtp(['','','','','','']); }}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, padding: 0, marginBottom: 20, fontFamily: 'Outfit, sans-serif' }}>
                  <ArrowLeft size={14} /> Change method
                </button>

                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Enter verification code</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px' }}>
                  Sent to <strong style={{ color: '#334155' }}>{maskedContact}</strong>
                </p>

                {error && <Alert msg={error} />}

                <form onSubmit={handleVerifyOtp}>
                  <label style={lbl}>6-digit code</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
                    {otp.map((d, i) => (
                      <input key={i} id={`otp-${i}`} type="text" inputMode="numeric" maxLength={1}
                        value={d} className="erp-inp"
                        style={{ ...inp, flex: 1, height: 54, padding: 0, textAlign: 'center', fontSize: 22, fontWeight: 700 }}
                        onChange={e => otpInput(e.target.value, i)}
                        onKeyDown={e => otpKey(e, i)} onPaste={otpPaste}
                        autoComplete="one-time-code" />
                    ))}
                  </div>

                  <button type="submit" className="erp-pbtn" style={primaryBtn}
                    disabled={loading || otp.join('').length < 6}>
                    {loading ? <Spin /> : <><span>Verify &amp; Sign In</span><ShieldCheck size={16} /></>}
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>Didn't receive a code?</span>
                    <button type="button" onClick={handleResend} disabled={resending}
                      style={{ background: 'none', border: 'none', color: B.brand500, fontFamily: 'Outfit, sans-serif', fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, opacity: resending ? 0.5 : 1 }}>
                      {resending ? <><Spin size={13} /> Sending…</> : 'Resend'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── REDIRECTING ─────────────────────────────────────────────── */}
            {step === 'redirecting' && redirectTarget && (
              <div className="erp-anim" style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 18px', background: 'rgba(18,183,106,0.08)', border: '2px solid rgba(18,183,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'erp-pop 0.4s ease both' }}>
                  <CheckCircle size={30} style={{ color: B.success }} />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Signed in successfully</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 4px' }}>
                  Redirecting to <strong style={{ color: '#334155' }}>{redirectTarget.profile.name}</strong>
                </p>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 24px' }}>in {countdown}s</p>
                <button onClick={() => redirectToSystem(redirectTarget)} className="erp-pbtn"
                  style={{ ...primaryBtn, marginTop: 0, background: 'rgba(18,183,106,0.1)', color: B.success, border: '1.5px solid rgba(18,183,106,0.25)' }}>
                  <span>Go now</span><ArrowRight size={16} />
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 900px) {
          #erp-left  { display: none !important; }
          #erp-right {
            justify-content: center !important;
            padding: 24px 16px !important;
            max-width: 100% !important;
          }
        }
        @media (max-width: 480px) {
          #erp-right > div {
            padding: 28px 20px !important;
            border-radius: 16px !important;
          }
        }
      `}</style>
    </>
  );
}
