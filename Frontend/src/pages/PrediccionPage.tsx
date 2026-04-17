import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, BarChart3, AlertTriangle, Target, Shuffle, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { API_BASE, SHORT_NAMES, ID_TO_KEY, PARTY_TO_KEY, CANDIDATE_COLORS } from '../types/election';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface ConfidenceInterval {
  p5_votes: number;
  p25_votes: number;
  p50_votes: number;
  p75_votes: number;
  p95_votes: number;
  p5_pct: number;
  p95_pct: number;
}

interface CandidatePrediction {
  candidate_id: string;
  name: string;
  party: string;
  current_votes: number;
  current_pct: number;
  predicted_votes: number;
  predicted_pct: number;
  confidence_interval: ConfidenceInterval;
  rank_probabilities: Record<string, number>;
  trend: { slope: number; momentum: number; volatility: number };
}

interface RankChange {
  challenger: { id: string; name: string; current_rank: number };
  defender: { id: string; name: string; current_rank: number };
  overtake_probability: number;
}

interface SimulationMeta {
  n_simulations: number;
  national_actas_pct: number;
  estimated_total_valid_votes: number;
  uncertainty_factor: number;
  regions_used: number;
}

interface RegionalPrediction {
  ubigeo: string;
  name: string;
  actas_pct: number;
  candidates: { id: string; name: string; party: string; predicted_votes: number; predicted_pct: number }[];
}

interface PredictionData {
  prediction_time: string;
  national_actas_pct: number;
  simulation: {
    candidates: Record<string, CandidatePrediction>;
    rank_changes: RankChange[];
    current_ranking: { rank: number; id: string; name: string }[];
    meta: SimulationMeta;
  };
  regional_predictions: RegionalPrediction[];
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function fmtNum(n: number): string {
  return n.toLocaleString('es-PE');
}

function fmtPct(n: number): string {
  return n.toFixed(3) + '%';
}

function candKey(id: string, party?: string): string {
  if (ID_TO_KEY[id]) return ID_TO_KEY[id];
  if (party && PARTY_TO_KEY[party]) return PARTY_TO_KEY[party];
  return id;
}

function candColor(id: string, party?: string): string {
  const key = candKey(id, party);
  return CANDIDATE_COLORS[key]?.color ?? '#666';
}

function candName(id: string, fallback: string, party?: string): string {
  const key = candKey(id, party);
  return SHORT_NAMES[key] ?? fallback.split(' ').pop() ?? fallback;
}

function probColor(p: number): string {
  if (p >= 0.5) return '#22c55e';
  if (p >= 0.2) return '#E6B41A';
  if (p >= 0.05) return '#E8943A';
  return '#E04848';
}

/* ── Component ──────────────────────────────────────────────────────────── */

export default function PrediccionPage() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/predictions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PredictionData = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrediction(); }, [fetchPrediction]);
  useEffect(() => {
    const iv = setInterval(fetchPrediction, 30_000);
    return () => clearInterval(iv);
  }, [fetchPrediction]);

  const sim = data?.simulation;
  const meta = sim?.meta;
  const candidates = sim?.candidates;
  const rankChanges = sim?.rank_changes;
  const regionals = data?.regional_predictions;

  const sortedCandidates = candidates
    ? Object.values(candidates).sort((a, b) => b.predicted_pct - a.predicted_pct).slice(0, 5)
    : [];

  const predictionTime = data?.prediction_time
    ? new Date(data.prediction_time).toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div className="space-y-4">
      {/* ══════════ Header ══════════ */}
      <div className="flex items-center justify-between gap-4 flex-wrap pt-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="min-w-[140px]">
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--tx1)' }}>
            <Target size={20} style={{ color: 'var(--c-rla)' }} />
            Predicción Electoral
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx3)' }}>
            Simulación Monte Carlo · {meta?.n_simulations?.toLocaleString('es-PE') ?? '10,000'} iteraciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          {predictionTime && (
            <span className="text-[10px]" style={{ color: 'var(--tx3)' }}>
              Última predicción: {predictionTime}
            </span>
          )}
          <button
            onClick={fetchPrediction}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md border transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:bg-[rgba(74,144,217,0.15)] hover:border-[var(--c-rla)]"
            style={{
              background: 'rgba(74,144,217,0.1)',
              borderColor: 'var(--c-rla)',
              color: 'var(--c-rla)',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-center py-2 rounded-md" style={{ background: 'var(--c-sanch-bg)', color: 'var(--c-sanch)' }}>
          Error: {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--tx3)' }}>
          Cargando predicciones…
        </div>
      )}

      {data && sim && meta && (
        <>
          {/* ══════════ Meta Info Bar ══════════ */}
          <div
            className="flex items-center gap-3 flex-wrap px-3.5 py-2.5 rounded-lg border animate-fade-up"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-semibold"
              style={{ background: 'rgba(74,144,217,0.1)', color: 'var(--c-rla)' }}>
              <BarChart3 size={13} />
              Actas: <span className="font-mono">{meta.national_actas_pct.toFixed(2)}%</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-semibold"
              style={{ background: 'rgba(230,180,26,0.1)', color: 'var(--c-nieto)' }}>
              <Shuffle size={13} />
              Simulaciones: <span className="font-mono">{fmtNum(meta.n_simulations)}</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-semibold"
              style={{ background: 'rgba(232,148,58,0.1)', color: 'var(--c-fuji)' }}>
              <AlertTriangle size={13} />
              Incertidumbre: <span className="font-mono">{(meta.uncertainty_factor * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px]"
              style={{ color: 'var(--tx3)' }}>
              Regiones: {meta.regions_used} · Votos válidos estimados: {fmtNum(meta.estimated_total_valid_votes)}
            </div>
          </div>

          {/* ══════════ Candidate Predictions ══════════ */}
          <div className="space-y-2">
            <h2 className="text-[13px] font-semibold" style={{ color: 'var(--tx2)' }}>
              Predicción al 100% de actas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {sortedCandidates.map((c, i) => {
                const color = candColor(c.candidate_id);
                const diff = c.predicted_pct - c.current_pct;
                const votesDiff = c.predicted_votes - c.current_votes;
                return (
                  <div
                    key={c.candidate_id}
                    className="rounded-[var(--radius)] border p-3 animate-fade-up"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: color + '44',
                      animationDelay: `${i * 60}ms`,
                    }}
                  >
                    {/* Rank badge */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: color }}
                        >
                          {i + 1}
                        </div>
                        <span className="text-[12px] font-semibold" style={{ color: 'var(--tx1)' }}>
                          {candName(c.candidate_id, c.name)}
                        </span>
                      </div>
                    </div>

                    {/* Predicted % */}
                    <div className="font-mono text-xl font-bold" style={{ color }}>
                      {fmtPct(c.predicted_pct)}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--tx3)' }}>
                      {fmtNum(c.predicted_votes)} votos
                    </div>

                    {/* Change from current */}
                    <div className="flex items-center gap-1 mt-2">
                      {diff > 0 ? (
                        <TrendingUp size={11} style={{ color: '#22c55e' }} />
                      ) : diff < 0 ? (
                        <TrendingDown size={11} style={{ color: '#E04848' }} />
                      ) : (
                        <Minus size={11} style={{ color: 'var(--tx3)' }} />
                      )}
                      <span className="text-[10px] font-mono" style={{ color: diff > 0 ? '#22c55e' : diff < 0 ? '#E04848' : 'var(--tx3)' }}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(3)}%
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--tx3)' }}>
                        ({votesDiff > 0 ? '+' : ''}{fmtNum(votesDiff)} votos)
                      </span>
                    </div>

                    {/* Confidence interval */}
                    <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: 'var(--tx3)' }}>
                        Intervalo 90%
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono" style={{ color: 'var(--tx3)' }}>
                          {fmtPct(c.confidence_interval.p5_pct)}
                        </span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-alt)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              background: color,
                              opacity: 0.5,
                              marginLeft: `${Math.max(0, (c.confidence_interval.p5_pct / Math.max(...sortedCandidates.map(x => x.confidence_interval.p95_pct))) * 100)}%`,
                              width: `${Math.max(5, ((c.confidence_interval.p95_pct - c.confidence_interval.p5_pct) / Math.max(...sortedCandidates.map(x => x.confidence_interval.p95_pct))) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--tx3)' }}>
                          {fmtPct(c.confidence_interval.p95_pct)}
                        </span>
                      </div>
                    </div>

                    {/* Momentum */}
                    <div className="mt-2 text-[10px]" style={{ color: 'var(--tx3)' }}>
                      Momentum: <span className="font-mono" style={{ color: c.trend.momentum > 0 ? '#22c55e' : c.trend.momentum < 0 ? '#E04848' : 'var(--tx3)' }}>
                        {c.trend.momentum > 0 ? '+' : ''}{c.trend.momentum.toFixed(4)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ══════════ Rank Change Probabilities ══════════ */}
          {rankChanges && rankChanges.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-[13px] font-semibold" style={{ color: 'var(--tx2)' }}>
                Probabilidad de cambio de posición
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {rankChanges.map((rc, i) => {
                  const prob = rc.overtake_probability;
                  const pColor = probColor(prob);
                  const challColor = candColor(rc.challenger.id);
                  const defColor = candColor(rc.defender.id);
                  return (
                    <div
                      key={i}
                      className="rounded-[var(--radius)] border p-3 animate-fade-up"
                      style={{
                        background: 'var(--bg-card)',
                        borderColor: 'var(--border)',
                        animationDelay: `${i * 80}ms`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--tx3)' }}>
                          {rc.challenger.current_rank}° → {rc.defender.current_rank}°
                        </span>
                        <div
                          className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style={{ background: pColor + '22', color: pColor }}
                        >
                          {(prob * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: challColor }} />
                          <span className="text-[11px] font-medium" style={{ color: 'var(--tx1)' }}>
                            {candName(rc.challenger.id, rc.challenger.name)}
                          </span>
                        </div>
                        <ChevronUp size={12} style={{ color: challColor }} />
                        <span className="text-[10px]" style={{ color: 'var(--tx3)' }}>pasa a</span>
                        <div className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: defColor }} />
                          <span className="text-[11px] font-medium" style={{ color: 'var(--tx1)' }}>
                            {candName(rc.defender.id, rc.defender.name)}
                          </span>
                        </div>
                      </div>
                      {/* Probability bar */}
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-alt)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${prob * 100}%`, background: pColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════ Rank Probability Matrix ══════════ */}
          {sortedCandidates.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-[13px] font-semibold" style={{ color: 'var(--tx2)' }}>
                Distribución de posiciones (probabilidad por rango)
              </h2>
              <div
                className="rounded-[var(--radius)] border overflow-hidden animate-fade-up"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ background: 'var(--bg-alt)' }}>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--tx2)' }}>
                        Candidato
                      </th>
                      {[1, 2, 3, 4, 5].map(r => (
                        <th key={r} className="text-center px-2 py-2 font-semibold" style={{ color: 'var(--tx2)' }}>
                          {r}°
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCandidates.map((c) => {
                      const color = candColor(c.candidate_id);
                      return (
                        <tr key={c.candidate_id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                              <span className="font-medium" style={{ color: 'var(--tx1)' }}>
                                {candName(c.candidate_id, c.name)}
                              </span>
                            </div>
                          </td>
                          {[1, 2, 3, 4, 5].map(r => {
                            const prob = c.rank_probabilities[String(r)] ?? 0;
                            const opacity = Math.max(0.05, prob);
                            return (
                              <td key={r} className="text-center px-2 py-2">
                                <div
                                  className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                                  style={{
                                    background: color + Math.round(opacity * 40).toString(16).padStart(2, '0'),
                                    color: prob > 0.3 ? color : 'var(--tx3)',
                                  }}
                                >
                                  {prob > 0 ? (prob * 100).toFixed(1) + '%' : '—'}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════ Regional Predictions ══════════ */}
          {regionals && regionals.length > 0 && (
            <RegionalSection regionals={regionals} />
          )}
        </>
      )}
    </div>
  );
}

/* ── Regional Predictions Collapsible ──────────────────────────────────── */

function RegionalSection({ regionals }: { regionals: RegionalPrediction[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...regionals].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[13px] font-semibold transition-all hover:opacity-80"
        style={{ color: 'var(--tx2)' }}
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Predicciones por región ({regionals.length})
      </button>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 animate-fade-up">
          {sorted.map((r) => {
            const winner = r.candidates[0];
            const winnerColor = winner ? candColor(winner.id, winner.party) : 'var(--tx3)';
            return (
              <div
                key={r.ubigeo}
                className="rounded-[var(--radius)] border p-3"
                style={{ background: 'var(--bg-card)', borderColor: winnerColor + '33' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--tx1)' }}>
                    {r.name}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--tx3)' }}>
                    {r.actas_pct.toFixed(1)}% actas
                  </span>
                </div>
                {r.candidates.slice(0, 3).map((c, i) => {
                  const color = candColor(c.id, c.party);
                  return (
                    <div key={c.id || c.party || i} className="flex items-center gap-2 py-0.5">
                      <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                      <span className="text-[10px] flex-1 truncate" style={{ color: 'var(--tx2)' }}>
                        {candName(c.id, c.name, c.party)}
                      </span>
                      <span className="text-[10px] font-mono font-medium" style={{ color }}>
                        {fmtPct(c.predicted_pct)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
