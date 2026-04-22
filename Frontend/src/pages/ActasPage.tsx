import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, FolderOpen, ChevronRight, Download, RefreshCw, AlertTriangle, CheckCircle2, Clock, Loader2, XCircle, PauseCircle } from 'lucide-react';
import { API_BASE } from '../types/election';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface ActasProgress {
  completed_districts: number;
  total_districts:     number;
  total_downloaded:    number;
  total_errors:        number;
  total_skipped:       number;
  current_location:    string | null;
  eta_seconds:         number | null;
  eta_human?:          string | null;
}

interface HistoryEntry {
  pct_trigger:      number;
  started_at:       string;
  completed_at:     string;
  total_downloaded: number;
  result:           string;
}

interface ActasStatus {
  status:           string;
  triggered_at_pct: number | null;
  session_date:     string | null;
  started_at:       string | null;
  completed_at:     string | null;
  last_updated:     string | null;
  error?:           string;
  progress:         ActasProgress;
  history:          HistoryEntry[];
}

interface BrowseItem {
  name:     string;
  type:     'dir' | 'file';
  size:     number | null;
  rel_path: string;
}

interface BrowseResult {
  path:  string;
  items: BrowseItem[];
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.FC<{ size?: number; className?: string }> }> = {
  idle:        { label: 'Inactivo',    color: 'var(--tx3)',  bg: 'var(--bg-alt)',  icon: Clock },
  downloading: { label: 'Descargando', color: '#3b82f6',     bg: '#3b82f620',      icon: Loader2 },
  completed:   { label: 'Completado',  color: '#22c55e',     bg: '#22c55e20',      icon: CheckCircle2 },
  interrupted: { label: 'Interrumpido',color: '#f97316',     bg: '#f9731620',      icon: PauseCircle },
  error:       { label: 'Error',       color: '#ef4444',     bg: '#ef444420',      icon: XCircle },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima' });
  } catch {
    return iso;
  }
}

function fmtSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function pct(a: number, b: number): number {
  return b === 0 ? 0 : Math.min(100, (a / b) * 100);
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function ActasPage() {
  const [status, setStatus]         = useState<ActasStatus | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [browse, setBrowse]         = useState<BrowseResult | null>(null);
  const [browsePath, setBrowsePath] = useState<string>('');
  const [browseLoading, setBrowseLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/actas/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ActasStatus = await res.json();
      setStatus(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const delay = status?.status === 'downloading' ? 3000 : 15000;
    intervalRef.current = setInterval(fetchStatus, delay);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status?.status, fetchStatus]);

  const openBrowser = useCallback(async (path = '') => {
    setBrowseLoading(true);
    try {
      const url = path ? `${API_BASE}/actas/browse/${path}` : `${API_BASE}/actas/browse`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BrowseResult = await res.json();
      setBrowse(data);
      setBrowsePath(path);
    } catch (e) {
      console.error('Browse error', e);
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const cfg = STATUS_CONFIG[status?.status ?? 'idle'] ?? STATUS_CONFIG.idle;
  const prog = status?.progress;
  const distPct = prog ? pct(prog.completed_districts, prog.total_districts) : 0;

  const crumbs = browsePath ? browsePath.split('/') : [];

  const isRootBrowse = browsePath === '';
  const browseDisplayItems = isRootBrowse
    ? (browse?.items ?? []).filter(item => item.type === 'dir')
    : (browse?.items ?? []);

  // Build ordered pct list from history + current in-progress (not yet in history)
  const sortedHistoryPcts = status
    ? [...status.history]
        .sort((a, b) => a.started_at.localeCompare(b.started_at))
        .map(h => h.pct_trigger)
    : [];
  const allTriggerPcts = [...sortedHistoryPcts];
  if (
    status?.triggered_at_pct != null &&
    allTriggerPcts[allTriggerPcts.length - 1] !== status.triggered_at_pct
  ) {
    allTriggerPcts.push(status.triggered_at_pct);
  }

  const getFolderLabel = (idx: number): { name: string; isLatest: boolean } => {
    const isLatest = idx === browseDisplayItems.length - 1;
    if (isLatest) return { name: 'Actas: latest', isLatest: true };
    const pct = allTriggerPcts[idx];
    return { name: `Actas: ${pct != null ? pct + '%' : '?'}`, isLatest: false };
  };

  return (
    <div className="mt-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" style={{ color: 'var(--tx1)' }}>
          <FileText size={18} style={{ color: 'var(--c-rla)' }} />
          <span className="text-[15px] font-bold">Actas Electorales</span>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-opacity hover:opacity-70"
          style={{ background: 'var(--bg-alt)', color: 'var(--tx2)', border: '1px solid var(--border)' }}
        >
          <RefreshCw size={11} />
          Actualizar
        </button>
      </div>

      {/* ── Connection error ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-[12px]" style={{ background: '#ef444420', color: '#ef4444' }}>
          <AlertTriangle size={14} />
          No se pudo conectar con el backend: {error}
        </div>
      )}

      {/* ── Status card ── */}
      {status && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

          {/* Status badge + trigger */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              <cfg.icon
                size={13}
                className={status.status === 'downloading' ? 'animate-spin' : undefined}
              />
              {cfg.label}
            </div>
            {status.triggered_at_pct !== null && (
              <span className="text-[11px]" style={{ color: 'var(--tx3)' }}>
                Disparado con {status.triggered_at_pct}% de actas
              </span>
            )}
            {status.session_date && (
              <span className="text-[11px]" style={{ color: 'var(--tx3)' }}>
                Sesión: {status.session_date}
              </span>
            )}
          </div>

          {/* Error message */}
          {status.error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded text-[11px]" style={{ background: '#ef444415', color: '#ef4444' }}>
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {status.error}
            </div>
          )}

          {/* Progress bar */}
          {prog && (
            <div className="space-y-2">
              <div className="flex justify-between text-[11px]" style={{ color: 'var(--tx3)' }}>
                <span>Distritos: {prog.completed_districts.toLocaleString()} / {prog.total_districts.toLocaleString()}</span>
                <span>{distPct.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-alt)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${distPct}%`, background: cfg.color }}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--tx3)' }}>
                <span>Descargados: <b style={{ color: 'var(--tx2)' }}>{prog.total_downloaded.toLocaleString()}</b></span>
                {prog.total_errors > 0 && (
                  <span style={{ color: '#ef4444' }}>Errores: <b>{prog.total_errors}</b></span>
                )}
                {prog.total_skipped > 0 && (
                  <span>Omitidos: <b style={{ color: 'var(--tx2)' }}>{prog.total_skipped}</b></span>
                )}
              </div>
            </div>
          )}

          {/* ETA + current location */}
          {status.status === 'downloading' && prog && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]" style={{ color: 'var(--tx3)' }}>
              {prog.eta_human && (
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  ETA: <b style={{ color: 'var(--tx2)' }}>{prog.eta_human}</b>
                </span>
              )}
              {prog.current_location && (
                <span>Ubicación actual: <b style={{ color: 'var(--tx2)' }}>{prog.current_location}</b></span>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]" style={{ color: 'var(--tx3)' }}>
            {status.started_at && <span>Inicio: {fmtDate(status.started_at)}</span>}
            {status.completed_at && <span>Fin: {fmtDate(status.completed_at)}</span>}
            {status.last_updated && <span>Actualizado: {fmtDate(status.last_updated)}</span>}
          </div>

          {/* File browser button */}
          <button
            onClick={() => openBrowser('')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--bg-alt)', color: 'var(--tx2)', border: '1px solid var(--border)' }}
          >
            <FolderOpen size={13} />
            Ver Archivos de Actas
          </button>
        </div>
      )}

      {/* ── File Browser ── */}
      {(browse || browseLoading) && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[12px] flex-wrap" style={{ color: 'var(--tx3)' }}>
              <button
                onClick={() => openBrowser('')}
                className="hover:opacity-70 font-semibold"
                style={{ color: 'var(--c-rla)' }}
              >
                Actas_Data
              </button>
              {crumbs.map((part, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight size={11} />
                  <button
                    onClick={() => openBrowser(crumbs.slice(0, i + 1).join('/'))}
                    className="hover:opacity-70"
                    style={{ color: i === crumbs.length - 1 ? 'var(--tx2)' : 'var(--c-rla)' }}
                  >
                    {part}
                  </button>
                </span>
              ))}
            </div>
            <button
              onClick={() => { setBrowse(null); setBrowsePath(''); }}
              className="text-[11px] hover:opacity-70 transition-opacity"
              style={{ color: 'var(--tx3)' }}
            >
              Cerrar
            </button>
          </div>

          {browseLoading ? (
            <div className="flex items-center gap-2 text-[12px] py-4 justify-center" style={{ color: 'var(--tx3)' }}>
              <Loader2 size={14} className="animate-spin" />
              Cargando…
            </div>
          ) : browseDisplayItems.length === 0 ? (
            <p className="text-[12px] py-4 text-center" style={{ color: 'var(--tx3)' }}>Carpeta vacía</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {browseDisplayItems.map((item, idx) => {
                const label = isRootBrowse ? getFolderLabel(idx) : null;
                const displayName = label ? label.name : item.name;
                const isLatest = label?.isLatest ?? false;
                return (
                  <div key={item.rel_path} className="flex items-center justify-between py-2">
                    <button
                      onClick={() => item.type === 'dir' ? openBrowser(item.rel_path) : undefined}
                      className={`flex items-center gap-2 text-[12px] text-left ${item.type === 'dir' ? 'hover:opacity-70 cursor-pointer' : 'cursor-default'}`}
                      style={{ color: item.type === 'dir' ? 'var(--c-rla)' : 'var(--tx2)' }}
                    >
                      {item.type === 'dir'
                        ? <FolderOpen size={13} />
                        : <FileText size={13} style={{ color: 'var(--tx3)' }} />
                      }
                      {isRootBrowse ? (
                        <span>
                          Actas:{' '}
                          <span style={{ color: isLatest ? '#22c55e' : 'var(--tx2)' }}>
                            {displayName.replace('Actas: ', '')}
                          </span>
                        </span>
                      ) : displayName}
                    </button>
                    <div className="flex items-center gap-3">
                      {item.size !== null && (
                        <span className="text-[10px]" style={{ color: 'var(--tx3)' }}>{fmtSize(item.size)}</span>
                      )}
                      {item.type === 'file' && (
                        <a
                          href={`${API_BASE}/actas/file/${item.rel_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded hover:opacity-80 transition-opacity"
                          style={{ background: 'var(--bg-alt)', color: 'var(--tx3)', border: '1px solid var(--border)' }}
                        >
                          <Download size={10} />
                          Abrir
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── History ── */}
      {status && status.history.length > 0 && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--tx1)' }}>Historial de descargas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ color: 'var(--tx3)', borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left pb-2 pr-4 font-medium">% Actas</th>
                  <th className="text-left pb-2 pr-4 font-medium">Inicio</th>
                  <th className="text-left pb-2 pr-4 font-medium">Fin</th>
                  <th className="text-right pb-2 pr-4 font-medium">Descargados</th>
                  <th className="text-left pb-2 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {[...status.history].reverse().map((h, i) => {
                  const resCfg = STATUS_CONFIG[h.result] ?? STATUS_CONFIG.idle;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-2 pr-4" style={{ color: 'var(--tx2)' }}>{h.pct_trigger}%</td>
                      <td className="py-2 pr-4" style={{ color: 'var(--tx3)' }}>{fmtDate(h.started_at)}</td>
                      <td className="py-2 pr-4" style={{ color: 'var(--tx3)' }}>{fmtDate(h.completed_at)}</td>
                      <td className="py-2 pr-4 text-right" style={{ color: 'var(--tx2)' }}>{h.total_downloaded.toLocaleString()}</td>
                      <td className="py-2">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: resCfg.bg, color: resCfg.color }}
                        >
                          {resCfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Reserved: anomaly detection graph ── */}
      <div
        className="rounded-xl p-6 flex flex-col items-center justify-center gap-2 min-h-[200px]"
        style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}
      >
        <FileText size={28} style={{ color: 'var(--tx3)', opacity: 0.4 }} />
        <p className="text-[12px] font-medium" style={{ color: 'var(--tx3)' }}>
          Gráfico de detección de anomalías
        </p>
        <p className="text-[11px]" style={{ color: 'var(--tx3)', opacity: 0.6 }}>
          Próximamente — análisis estadístico de irregularidades en actas
        </p>
      </div>

    </div>
  );
}
