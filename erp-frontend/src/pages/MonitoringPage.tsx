import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  RefreshCw, CheckCircle, XCircle, AlertCircle,
  Database, Clock, Users, Cpu, Activity,
  ShieldCheck, Monitor, Building2, ArrowLeft,
  Wifi, WifiOff, FileText, ChevronLeft, ChevronRight,
  Search, Filter,
} from 'lucide-react';
import PortalNav from '../components/PortalNav';
import { useErpAuth } from '../store/authStore';
import client from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile { id: number; name: string; icon: string; app_url: string; api_base_url: string; }

interface SystemHealth {
  profile: Profile;
  reachable: boolean; status: boolean;
  system?: string; environment?: string;
  uptime_seconds?: number; uptime_human?: string;
  db?: { status: 'ok'|'error'|'unknown'; latency_ms: number|null; };
  users?: { total: number; active: number; };
  icdvs?: { total: number; };
  errors_last_24h?: number|null;
  memory_mb?: number|null; node_version?: string;
  latency_ms: number; error?: string; timestamp?: string;
}

interface LogEntry {
  id: number; correlation_id: string; integration: string;
  method: string; url: string; response_status: number|null;
  error_message: string|null; duration_ms: number|null;
  triggered_by: number|null; context: string|null;
  status: 'success'|'error'|'pending'; created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const isTokenExpired = (t: string) => { try { return JSON.parse(atob(t.split('.')[1])).exp*1000<Date.now(); } catch { return true; } };
const latencyColor   = (ms: number|null) => ms===null ? 'var(--text-muted)' : ms<200 ? '#12b76a' : ms<800 ? '#f59e0b' : '#f04438';
const statusColor    = (ok: boolean) => ok ? '#12b76a' : '#f04438';

const SystemIcon = ({ icon, size=20 }: { icon:string; size?:number }) => {
  const map: Record<string,React.ReactNode> = {
    'shield-check':<ShieldCheck size={size}/>,'container':<Monitor size={size}/>,
    'layout-dashboard':<Monitor size={size}/>,'building-2':<Building2 size={size}/>,'monitor':<Monitor size={size}/>,
  };
  return <>{map[icon]??<Monitor size={size}/>}</>;
};

const methodColor: Record<string,string> = { GET:'#3b82f6',POST:'#12b76a',PATCH:'#f59e0b',PUT:'#f59e0b',DELETE:'#f04438' };

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MonitoringPage() {
  const navigate   = useNavigate();
  const { erpToken } = useErpAuth();
  const token      = erpToken ?? localStorage.getItem('erp_token') ?? '';

  const [tab,        setTab]       = useState<'health'|'logs'>('health');
  const [systems,    setSystems]   = useState<SystemHealth[]>([]);
  const [fetchedAt,  setFetchedAt] = useState<string|null>(null);
  const [loadingH,   setLoadingH]  = useState(true);
  const [errorH,     setErrorH]    = useState('');
  const [autoRefresh,setAuto]      = useState(false);

  // Logs state
  const [selectedProfile, setProfile] = useState<Profile|null>(null);
  const [logs,       setLogs]      = useState<LogEntry[]>([]);
  const [logsTotal,  setLogsTotal] = useState(0);
  const [logsPage,   setLogsPage]  = useState(1);
  const [logsStatus, setLogsStatus]= useState('');
  const [logsSearch, setLogsSearch]= useState('');
  const [loadingL,   setLoadingL]  = useState(false);
  const [errorL,     setErrorL]    = useState('');

  useEffect(() => { if (!token || isTokenExpired(token)) navigate('/', {replace:true}); }, [token, navigate]);

  const fetchHealth = useCallback(async () => {
    setLoadingH(true); setErrorH('');
    try {
      const { data } = await client.get('/health/systems', { headers: { Authorization:`Bearer ${token}` } });
      setSystems(data.systems??[]);
      setFetchedAt(data.fetched_at);
      if (!selectedProfile && data.systems?.length) setProfile(data.systems[0].profile);
    } catch(e:any) { setErrorH(e.response?.data?.message||'Failed to fetch system health.'); }
    finally { setLoadingH(false); }
  }, [token]);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);
  useEffect(() => { if (!autoRefresh) return; const t=setInterval(fetchHealth,30000); return ()=>clearInterval(t); }, [autoRefresh,fetchHealth]);

  const fetchLogs = useCallback(async (profile: Profile, page: number, status: string, search: string) => {
    setLoadingL(true); setErrorL('');
    try {
      const params = new URLSearchParams({ profileId: String(profile.id), page: String(page), limit: '50' });
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      const { data } = await client.get(`/health/logs?${params}`, { headers: { Authorization:`Bearer ${token}` } });
      setLogs(data.data??[]);
      setLogsTotal(data.total??0);
    } catch(e:any) { setErrorL(e.response?.data?.message||'Failed to fetch logs.'); }
    finally { setLoadingL(false); }
  }, [token]);

  useEffect(() => {
    if (tab==='logs' && selectedProfile) fetchLogs(selectedProfile, logsPage, logsStatus, logsSearch);
  }, [tab, selectedProfile, logsPage, logsStatus]);

  const healthy  = systems.filter(s=>s.reachable&&s.db?.status==='ok').length;
  const degraded = systems.filter(s=>s.reachable&&s.db?.status!=='ok').length;
  const down     = systems.filter(s=>!s.reachable).length;

  return (
    <div style={{minHeight:'100vh',background:'var(--bg-page)',fontFamily:'Outfit, sans-serif',transition:'background 0.2s'}}>
      <PortalNav activePage="monitoring"/>
      <main style={{maxWidth:1100,margin:'0 auto',padding:'36px 24px'}}>

        {/* Back */}
        <button onClick={()=>navigate('/dashboard')}
          style={{display:'inline-flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--text-muted)',fontFamily:'Outfit,sans-serif',fontSize:13,cursor:'pointer',padding:0,marginBottom:16}}
          onMouseEnter={e=>(e.currentTarget.style.color='var(--text-primary)')}
          onMouseLeave={e=>(e.currentTarget.style.color='var(--text-muted)')}>
          <ArrowLeft size={14}/> Back to Dashboard
        </button>

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:800,color:'var(--text-primary)',margin:'0 0 4px',letterSpacing:'-0.3px'}}>System Monitoring</h1>
            <p style={{fontSize:13,color:'var(--text-muted)',margin:0}}>
              Health &amp; integration logs across all connected systems
              {fetchedAt && <> · {new Date(fetchedAt).toLocaleTimeString()}</>}
            </p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={()=>setAuto(a=>!a)}
              style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,border:`1px solid ${autoRefresh?'rgba(70,95,255,0.3)':'var(--border-strong)'}`,background:autoRefresh?'var(--brand-soft)':'transparent',color:autoRefresh?'var(--brand)':'var(--text-muted)',fontFamily:'Outfit,sans-serif',fontSize:12,cursor:'pointer'}}>
              <Activity size={13}/>{autoRefresh?'Live (30s)':'Auto off'}
            </button>
            <button onClick={fetchHealth} disabled={loadingH}
              style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,border:'1px solid var(--border-strong)',background:'var(--brand-soft)',color:'var(--brand)',fontFamily:'Outfit,sans-serif',fontSize:12,cursor:'pointer',opacity:loadingH?0.6:1}}>
              <RefreshCw size={13} style={{animation:loadingH?'erp-spin 0.8s linear infinite':'none'}}/> Refresh
            </button>
          </div>
        </div>

        {/* Summary */}
        {!loadingH && systems.length>0 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
            <SummaryCard label="Healthy"     value={healthy}  color="#12b76a" icon={<CheckCircle size={18}/>}/>
            <SummaryCard label="Degraded"    value={degraded} color="#f59e0b" icon={<AlertCircle size={18}/>}/>
            <SummaryCard label="Unreachable" value={down}     color="#f04438" icon={<WifiOff size={18}/>}/>
          </div>
        )}

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:24,gap:4}}>
          {(['health','logs'] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)}
              style={{display:'flex',alignItems:'center',gap:7,padding:'10px 16px',border:'none',background:'transparent',fontFamily:'Outfit,sans-serif',fontSize:13,fontWeight:tab===t?600:500,color:tab===t?'var(--brand)':'var(--text-muted)',cursor:'pointer',borderBottom:tab===t?'2px solid var(--brand)':'2px solid transparent',marginBottom:-1,transition:'color 0.18s'}}>
              {t==='health'?<Activity size={14}/>:<FileText size={14}/>}
              {t==='health'?'Health Status':'Integration Logs'}
            </button>
          ))}
        </div>

        {/* ── HEALTH TAB ── */}
        {tab==='health' && (
          <>
            {errorH && <ErrBanner msg={errorH}/>}
            {loadingH ? <LoadingSkel count={4}/> : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:14}}>
                {systems.map((sys,i) => <SystemCard key={sys.profile.id} sys={sys} index={i}/>)}
              </div>
            )}
          </>
        )}

        {/* ── LOGS TAB ── */}
        {tab==='logs' && (
          <div>
            {/* System selector */}
            <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
              {systems.map(s => (
                <button key={s.profile.id} onClick={()=>{setProfile(s.profile);setLogsPage(1);}}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:8,border:`1px solid ${selectedProfile?.id===s.profile.id?'var(--brand)':'var(--border)'}`,background:selectedProfile?.id===s.profile.id?'var(--brand-soft)':'transparent',color:selectedProfile?.id===s.profile.id?'var(--brand)':'var(--text-secondary)',fontFamily:'Outfit,sans-serif',fontSize:12,cursor:'pointer'}}>
                  <SystemIcon icon={s.profile.icon} size={13}/> {s.profile.name}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
              <div style={{position:'relative',flex:1,minWidth:200}}>
                <Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
                <input placeholder="Search URL, context, correlation ID..." value={logsSearch}
                  onChange={e=>setLogsSearch(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&selectedProfile&&fetchLogs(selectedProfile,1,logsStatus,logsSearch)}
                  style={{width:'100%',height:36,paddingLeft:32,paddingRight:12,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8,fontFamily:'Outfit,sans-serif',fontSize:13,color:'var(--text-primary)',outline:'none'}}/>
              </div>
              <select value={logsStatus} onChange={e=>{setLogsStatus(e.target.value);setLogsPage(1);}}
                style={{height:36,padding:'0 12px',background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8,fontFamily:'Outfit,sans-serif',fontSize:13,color:'var(--text-primary)',cursor:'pointer'}}>
                <option value="">All statuses</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="pending">Pending</option>
              </select>
              <button onClick={()=>selectedProfile&&fetchLogs(selectedProfile,logsPage,logsStatus,logsSearch)}
                disabled={loadingL}
                style={{display:'flex',alignItems:'center',gap:6,height:36,padding:'0 14px',borderRadius:8,border:'1px solid var(--border-strong)',background:'var(--brand-soft)',color:'var(--brand)',fontFamily:'Outfit,sans-serif',fontSize:12,cursor:'pointer',opacity:loadingL?0.6:1}}>
                <RefreshCw size={13} style={{animation:loadingL?'erp-spin 0.8s linear infinite':'none'}}/> Load
              </button>
            </div>

            {errorL && <ErrBanner msg={errorL}/>}

            {/* Logs table */}
            {loadingL ? <LoadingSkel count={6} height={44}/> : (
              <>
                <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
                  {/* Table header */}
                  <div style={{display:'grid',gridTemplateColumns:'60px 100px 80px 1fr 80px 90px 100px 120px',gap:0,padding:'10px 16px',background:'var(--bg-page)',borderBottom:'1px solid var(--border)',fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>
                    <span>ID</span><span>Method</span><span>Status</span><span>URL</span><span>Duration</span><span>Result</span><span>Context</span><span>Time</span>
                  </div>

                  {logs.length===0 ? (
                    <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-muted)',fontSize:13}}>
                      No logs found
                    </div>
                  ) : logs.map((log,i) => (
                    <div key={log.id} style={{display:'grid',gridTemplateColumns:'60px 100px 80px 1fr 80px 90px 100px 120px',gap:0,padding:'11px 16px',borderBottom:i<logs.length-1?'1px solid var(--border)':'none',fontSize:12,color:'var(--text-primary)',alignItems:'center'}}>
                      <span style={{color:'var(--text-muted)',fontSize:11}}>#{log.id}</span>
                      <span style={{fontWeight:700,color:methodColor[log.method]??'var(--text-primary)',fontSize:11}}>{log.method}</span>
                      <span>
                        {log.response_status ? (
                          <span style={{padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:600,
                            background:log.response_status<300?'rgba(18,183,106,0.1)':log.response_status<400?'rgba(59,130,246,0.1)':'rgba(240,68,56,0.1)',
                            color:log.response_status<300?'#12b76a':log.response_status<400?'#3b82f6':'#f04438'}}>
                            {log.response_status}
                          </span>
                        ) : '—'}
                      </span>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11,color:'var(--text-secondary)',paddingRight:8}} title={log.url}>{log.url}</span>
                      <span style={{color:latencyColor(log.duration_ms),fontSize:11}}>{log.duration_ms!=null?`${log.duration_ms}ms`:'—'}</span>
                      <span>
                        <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,
                          color:log.status==='success'?'#12b76a':log.status==='error'?'#f04438':'#f59e0b'}}>
                          {log.status==='success'?<CheckCircle size={11}/>:log.status==='error'?<XCircle size={11}/>:<AlertCircle size={11}/>}
                          {log.status}
                        </span>
                      </span>
                      <span style={{fontSize:11,color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={log.context??''}>{log.context??'—'}</span>
                      <span style={{fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {logsTotal > 50 && (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:14,fontSize:13,color:'var(--text-muted)'}}>
                    <span>Showing {(logsPage-1)*50+1}–{Math.min(logsPage*50,logsTotal)} of {logsTotal}</span>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>setLogsPage(p=>Math.max(1,p-1))} disabled={logsPage===1||loadingL}
                        style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',borderRadius:7,border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--text-secondary)',fontFamily:'Outfit,sans-serif',fontSize:12,cursor:'pointer',opacity:logsPage===1?0.4:1}}>
                        <ChevronLeft size={13}/> Prev
                      </button>
                      <button onClick={()=>setLogsPage(p=>p+1)} disabled={logsPage*50>=logsTotal||loadingL}
                        style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',borderRadius:7,border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--text-secondary)',fontFamily:'Outfit,sans-serif',fontSize:12,cursor:'pointer',opacity:logsPage*50>=logsTotal?0.4:1}}>
                        Next <ChevronRight size={13}/>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
      <style>{`
        @keyframes erp-spin   { to { transform:rotate(360deg); } }
        @keyframes mon-fadeUp { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        @media(max-width:600px){main{padding:20px 12px !important;}}
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ErrBanner({ msg }: { msg: string }) {
  return (
    <div style={{display:'flex',gap:10,alignItems:'center',padding:'12px 16px',background:'rgba(240,68,56,0.06)',border:'1px solid rgba(240,68,56,0.2)',borderRadius:10,marginBottom:20,fontSize:13,color:'#f04438'}}>
      <AlertCircle size={15}/> {msg}
    </div>
  );
}

function LoadingSkel({ count, height=200 }: { count:number; height?:number }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:14}}>
      {Array.from({length:count}).map((_,n) => (
        <div key={n} style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,padding:22,height}}>
          <div style={{height:12,width:'60%',background:'var(--border)',borderRadius:6,marginBottom:16}}/>
          {[70,55,45,35].map((w,i)=><div key={i} style={{height:10,width:`${w}%`,background:'var(--border)',borderRadius:6,marginBottom:10}}/>)}
        </div>
      ))}
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label:string;value:number;color:string;icon:React.ReactNode }) {
  return (
    <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 20px',display:'flex',alignItems:'center',gap:14,boxShadow:'var(--shadow-card)'}}>
      <div style={{width:40,height:40,borderRadius:10,background:`${color}18`,display:'flex',alignItems:'center',justifyContent:'center',color,flexShrink:0}}>{icon}</div>
      <div>
        <div style={{fontSize:24,fontWeight:800,color:'var(--text-primary)',lineHeight:1}}>{value}</div>
        <div style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>{label}</div>
      </div>
    </div>
  );
}

function SystemCard({ sys, index }: { sys:SystemHealth; index:number }) {
  const isUp     = sys.reachable;
  const dbOk     = sys.db?.status==='ok';
  const ok       = isUp&&dbOk;
  const sbg      = ok?'rgba(18,183,106,0.08)':isUp?'rgba(245,158,11,0.08)':'rgba(240,68,56,0.08)';
  const sborder  = ok?'rgba(18,183,106,0.2)':isUp?'rgba(245,158,11,0.2)':'rgba(240,68,56,0.2)';
  const sdot     = ok?'#12b76a':isUp?'#f59e0b':'#f04438';
  const slabel   = ok?'Healthy':isUp?'Degraded':'Unreachable';

  return (
    <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 22px',boxShadow:'var(--shadow-card)',animation:`mon-fadeUp 0.35s ${index*0.05}s ease both`}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:40,height:40,borderRadius:11,background:'var(--brand-soft)',border:'1px solid rgba(70,95,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--brand)',flexShrink:0}}>
            <SystemIcon icon={sys.profile.icon} size={20}/>
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>{sys.profile.name}</div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>{sys.environment??''}</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,background:sbg,border:`1px solid ${sborder}`,fontSize:11,fontWeight:600,color:sdot,flexShrink:0}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:sdot,boxShadow:ok?`0 0 5px ${sdot}`:'none'}}/>
          {slabel}
        </div>
      </div>
      {!isUp&&sys.error&&(
        <div style={{fontSize:12,color:'#f04438',background:'rgba(240,68,56,0.06)',border:'1px solid rgba(240,68,56,0.15)',borderRadius:8,padding:'8px 12px',marginBottom:12}}>{sys.error}</div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <Metric icon={<Wifi size={13}/>}        label="Response"    value={sys.latency_ms!=null?`${sys.latency_ms}ms`:'—'} color={latencyColor(sys.latency_ms)}/>
        <Metric icon={<Database size={13}/>}    label="Database"    value={sys.db?.status??'—'} color={statusColor(dbOk)} extraVal={sys.db?.latency_ms!=null?`${sys.db.latency_ms}ms`:undefined}/>
        <Metric icon={<Clock size={13}/>}       label="Uptime"      value={sys.uptime_human??'—'}/>
        <Metric icon={<Cpu size={13}/>}         label="Memory"      value={sys.memory_mb!=null?`${sys.memory_mb} MB`:'—'}/>
        <Metric icon={<Users size={13}/>}       label="Users"       value={sys.users?`${sys.users.active} / ${sys.users.total}`:'—'}/>
        <Metric icon={<AlertCircle size={13}/>} label="Errors (24h)"value={sys.errors_last_24h!=null?String(sys.errors_last_24h):'—'} color={sys.errors_last_24h?(sys.errors_last_24h>10?'#f04438':'#f59e0b'):'#12b76a'}/>
      </div>
      {sys.timestamp&&(
        <div style={{marginTop:12,paddingTop:10,borderTop:'1px solid var(--border)',fontSize:11,color:'var(--text-muted)'}}>
          Reported {new Date(sys.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function Metric({ icon,label,value,color,extraVal }: { icon:React.ReactNode;label:string;value:string;color?:string;extraVal?:string; }) {
  return (
    <div style={{background:'var(--bg-page)',borderRadius:8,padding:'9px 11px',border:'1px solid var(--border)'}}>
      <div style={{display:'flex',alignItems:'center',gap:5,color:'var(--text-muted)',fontSize:11,marginBottom:4}}>{icon} {label}</div>
      <div style={{fontSize:13,fontWeight:600,color:color??'var(--text-primary)',display:'flex',alignItems:'center',gap:6}}>
        {value}
        {extraVal&&<span style={{fontSize:11,fontWeight:400,color:'var(--text-muted)'}}>{extraVal}</span>}
      </div>
    </div>
  );
}
