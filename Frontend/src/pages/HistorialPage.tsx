import { useMemo, useEffect, useRef } from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import { createChart, type IChartApi, ColorType } from 'lightweight-charts';
import { useElectionData } from '../hooks/useElectionData';
import {
  SHORT_NAMES,
  getCandidateColorByKey,
  getCandidateKey,
} from '../types/election';

export default function HistorialPage() {
  const { timeline, history, loading } = useElectionData();

  const candidateKeys = timeline ? Object.keys(timeline.candidate_info) : [];

  const diffData = useMemo(() => {
    if (!timeline) return [];
    return timeline.cuts.map((cut) => {
      const vals = Object.entries(cut.candidates)
        .sort(([, a], [, b]) => b - a);
      return {
        actas_pct: cut.actas_pct,
        diff_1v2: (vals[0]?.[1] ?? 0) - (vals[1]?.[1] ?? 0),
        diff_2v3: (vals[1]?.[1] ?? 0) - (vals[2]?.[1] ?? 0),
        diff_3v4: (vals[2]?.[1] ?? 0) - (vals[3]?.[1] ?? 0),
      };
    });
  }, [timeline]);

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) =>
      new Date(b.snapshot_time).getTime() - new Date(a.snapshot_time).getTime()
    );
  }, [history]);

  function formatTime(ts: string) {
    return new Date(ts).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="space-y-5 pt-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--tx1)' }}>
          Historial y Evolución
        </h2>
        <p className="text-[11px]" style={{ color: 'var(--tx3)' }}>
          {timeline ? `${timeline.cuts_count} cortes desde el inicio del conteo` : 'Cargando...'}
          {history.length > 0 && ` · ${history.length} snapshots guardados`}
        </p>
      </div>

      {/* ══════════ Candidate Evolution ══════════ */}
      {timeline && <CandidateEvolutionChart timeline={timeline} candidateKeys={candidateKeys} />}

      {/* ══════════ Diff Evolution Chart ══════════ */}
      {diffData.length > 0 && <DiffEvolutionChart diffData={diffData} />}

      {/* ══════════ Snapshots Table ══════════ */}
      <div
        className="rounded-[var(--radius)] border overflow-hidden animate-fade-up"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <h3 className="text-[13px] font-semibold px-4 pt-3 pb-2 flex items-center gap-2" style={{ color: 'var(--tx2)' }}>
          <Clock size={14} style={{ color: 'var(--c-nieto)' }} />
          Snapshots guardados ({sortedHistory.length})
        </h3>
        {loading && sortedHistory.length === 0 ? (
          <div className="p-6 text-center text-[12px]" style={{ color: 'var(--tx3)' }}>
            Cargando historial...
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ maxHeight: 400 }}>
            <table className="w-full text-left">
              <thead>
                <tr style={{ background: 'var(--bg-alt)' }}>
                  <th className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold sticky top-0" style={{ color: 'var(--tx3)', background: 'var(--bg-alt)' }}>Fecha</th>
                  <th className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold sticky top-0" style={{ color: 'var(--tx3)', background: 'var(--bg-alt)' }}>Actas %</th>
                  <th className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold sticky top-0" style={{ color: 'var(--tx3)', background: 'var(--bg-alt)' }}>Contab.</th>
                  <th className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold sticky top-0" style={{ color: 'var(--tx3)', background: 'var(--bg-alt)' }}>1° Lugar</th>
                  <th className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold sticky top-0" style={{ color: 'var(--tx3)', background: 'var(--bg-alt)' }}>2° Lugar</th>
                  <th className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold sticky top-0" style={{ color: 'var(--tx3)', background: 'var(--bg-alt)' }}>Dif.</th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((snap, i) => {
                  const c1 = snap.candidates[0];
                  const c2 = snap.candidates[1];
                  const diff = c1 && c2 ? (c1.percentage - c2.percentage).toFixed(3) : '—';
                  return (
                    <tr
                      key={i}
                      className="border-t transition-colors hover:bg-white/[0.02]"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td className="px-3 py-2 font-mono text-[11px]" style={{ color: 'var(--tx2)' }}>
                        {formatTime(snap.snapshot_time)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] font-semibold" style={{ color: 'var(--c-nieto)' }}>
                        {snap.actas.actas_contabilizadas_pct.toFixed(3)}%
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]" style={{ color: 'var(--tx2)' }}>
                        {snap.actas.actas_contabilizadas.toLocaleString('es-PE')}
                      </td>
                      <td className="px-3 py-2 text-[11px] font-semibold" style={{ color: 'var(--tx1)' }}>
                        {c1 ? `${SHORT_NAMES[getCandidateKey(c1)] ?? c1.name.split(' ').pop()} ${c1.percentage.toFixed(3)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-[11px]" style={{ color: 'var(--tx2)' }}>
                        {c2 ? `${SHORT_NAMES[getCandidateKey(c2)] ?? c2.name.split(' ').pop()} ${c2.percentage.toFixed(3)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] font-semibold" style={{ color: 'var(--c-fuji)' }}>
                        {diff}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function chartOptions(height: number) {
  return {
    height,
    layout: {
      background: { type: ColorType.Solid as const, color: 'transparent' },
      textColor: '#8A8F98',
      fontFamily: 'DM Mono, monospace',
      fontSize: 10,
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.04)' },
      horzLines: { color: 'rgba(255,255,255,0.04)' },
    },
    crosshair: {
      vertLine: { color: 'rgba(255,255,255,0.1)', width: 1 as const, labelBackgroundColor: '#1C1E23' },
      horzLine: { color: 'rgba(255,255,255,0.1)', width: 1 as const, labelBackgroundColor: '#1C1E23' },
    },
    rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
    timeScale: {
      borderColor: 'rgba(255,255,255,0.08)',
      tickMarkFormatter: (time: number) => `${time.toFixed(0)}%`,
    },
    handleScroll: true,
    handleScale: true,
  };
}

interface CandidateEvolutionChartProps {
  timeline: import('../types/election').Timeline;
  candidateKeys: string[];
}

function CandidateEvolutionChart({ timeline, candidateKeys }: CandidateEvolutionChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(el, { ...chartOptions(350), width: el.clientWidth,
      localization: { priceFormatter: (p: number) => `${p.toFixed(3)}%` },
    });
    chartRef.current = chart;

    for (const key of candidateKeys) {
      const series = chart.addLineSeries({
        color: getCandidateColorByKey(key),
        lineWidth: 2,
        title: SHORT_NAMES[key] ?? key,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerRadius: 4,
      });
      const raw = timeline.cuts
        .map((cut) => ({ time: cut.actas_pct, value: cut.candidates[key] ?? 0 }))
        .sort((a, b) => a.time - b.time);
      const deduped = new Map<number, { time: number; value: number }>();
      for (const d of raw) deduped.set(d.time, d);
      series.setData([...deduped.values()] as any);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((e) => chart.applyOptions({ width: e[0].contentRect.width }));
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, [timeline, candidateKeys.join(',')]);

  return (
    <div
      className="rounded-[var(--radius)] p-4 border animate-fade-up"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--tx2)' }}>
        <TrendingUp size={14} style={{ color: 'var(--c-nieto)' }} />
        Evolución de candidatos (% votos vs % actas)
      </h3>
      <div ref={containerRef} style={{ width: '100%', height: 350 }} />
      <div className="flex flex-wrap gap-3 mt-3">
        {candidateKeys.map((key) => (
          <div key={key} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--tx2)' }}>
            <div className="w-2.5 h-1 rounded-sm" style={{ background: getCandidateColorByKey(key) }} />
            {SHORT_NAMES[key] ?? key}
          </div>
        ))}
      </div>
    </div>
  );
}

interface DiffItem { actas_pct: number; diff_1v2: number; diff_2v3: number; diff_3v4: number }

const DIFF_SERIES = [
  { key: 'diff_1v2' as const, label: '1° vs 2°', line: '#E8943A', top: 'rgba(232,148,58,0.20)', bottom: 'rgba(232,148,58,0.02)' },
  { key: 'diff_2v3' as const, label: '2° vs 3°', line: '#4A90D9', top: 'rgba(74,144,217,0.20)', bottom: 'rgba(74,144,217,0.02)' },
  { key: 'diff_3v4' as const, label: '3° vs 4°', line: '#B07CD8', top: 'rgba(176,124,216,0.20)', bottom: 'rgba(176,124,216,0.02)' },
];

function DiffEvolutionChart({ diffData }: { diffData: DiffItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(el, { ...chartOptions(280), width: el.clientWidth,
      localization: { priceFormatter: (p: number) => `${p.toFixed(3)} pp` },
    });
    chartRef.current = chart;

    for (const cfg of DIFF_SERIES) {
      const series = chart.addAreaSeries({
        lineColor: cfg.line,
        topColor: cfg.top,
        bottomColor: cfg.bottom,
        lineWidth: 2,
        title: cfg.label,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerRadius: 4,
      });
      const raw = diffData
        .map((d) => ({ time: d.actas_pct, value: d[cfg.key] }))
        .sort((a, b) => a.time - b.time);
      const deduped = new Map<number, { time: number; value: number }>();
      for (const d of raw) deduped.set(d.time, d);
      series.setData([...deduped.values()] as any);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((e) => chart.applyOptions({ width: e[0].contentRect.width }));
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, [diffData]);

  return (
    <div
      className="rounded-[var(--radius)] p-4 border animate-fade-up"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--tx2)' }}>
        <TrendingUp size={14} style={{ color: 'var(--c-fuji)' }} />
        Diferencia entre posiciones (puntos porcentuales)
      </h3>
      <div ref={containerRef} style={{ width: '100%', height: 280 }} />
      <div className="flex flex-wrap gap-4 mt-3">
        {DIFF_SERIES.map((cfg) => (
          <div key={cfg.key} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--tx2)' }}>
            <div className="w-2.5 h-1 rounded-sm" style={{ background: cfg.line }} />
            {cfg.label}
          </div>
        ))}
      </div>
    </div>
  );
}
