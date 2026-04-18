import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useElectionData } from '../hooks/useElectionData';
import { SHORT_NAMES, getCandidateKey } from '../types/election';
import TimelineChart from '../components/TimelineChart';
import DiffEvolutionChart from '../components/DiffEvolutionChart';

export default function HistorialPage() {
  const { timeline, history, loading } = useElectionData();

  const diffData = useMemo(() => {
    if (!timeline) return [];
    return timeline.cuts.map((cut) => {
      const vals = Object.entries(cut.candidates).sort(([, a], [, b]) => b - a);
      return {
        actas_pct: cut.actas_pct,
        diff_1v2: (vals[0]?.[1] ?? 0) - (vals[1]?.[1] ?? 0),
        diff_2v3: (vals[1]?.[1] ?? 0) - (vals[2]?.[1] ?? 0),
        diff_3v4: (vals[2]?.[1] ?? 0) - (vals[3]?.[1] ?? 0),
      };
    });
  }, [timeline]);

  const sortedHistory = useMemo(() => {
    return [...history].sort(
      (a, b) => new Date(b.snapshot_time).getTime() - new Date(a.snapshot_time).getTime(),
    );
  }, [history]);

  function formatTime(ts: string) {
    return new Date(ts).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-5 pt-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--tx1)' }}>
          Historial y Evolución
        </h2>
        <p className="text-[11px]" style={{ color: 'var(--tx3)' }}>
          {timeline
            ? `${timeline.cuts_count} cortes desde el inicio del conteo`
            : 'Cargando...'}
          {history.length > 0 && ` · ${history.length} snapshots guardados`}
        </p>
      </div>

      {timeline && <TimelineChart timeline={timeline} />}
      {diffData.length > 0 && <DiffEvolutionChart diffData={diffData} />}

      {/* Snapshots Table */}
      <div
        className="rounded-[var(--radius)] border overflow-hidden animate-fade-up"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <h3
          className="text-[13px] font-semibold px-4 pt-3 pb-2 flex items-center gap-2"
          style={{ color: 'var(--tx2)' }}
        >
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
                  {['Fecha', 'Actas %', 'Contab.', '1° Lugar', '2° Lugar', 'Dif.'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold sticky top-0"
                      style={{ color: 'var(--tx3)', background: 'var(--bg-alt)' }}
                    >
                      {h}
                    </th>
                  ))}
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
                      <td
                        className="px-3 py-2 font-mono text-[12px] font-semibold"
                        style={{ color: 'var(--c-nieto)' }}
                      >
                        {snap.actas.actas_contabilizadas_pct.toFixed(3)}%
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]" style={{ color: 'var(--tx2)' }}>
                        {snap.actas.actas_contabilizadas.toLocaleString('es-PE')}
                      </td>
                      <td
                        className="px-3 py-2 text-[11px] font-semibold"
                        style={{ color: 'var(--tx1)' }}
                      >
                        {c1
                          ? `${SHORT_NAMES[getCandidateKey(c1)] ?? c1.name.split(' ').pop()} ${c1.percentage.toFixed(3)}%`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-[11px]" style={{ color: 'var(--tx2)' }}>
                        {c2
                          ? `${SHORT_NAMES[getCandidateKey(c2)] ?? c2.name.split(' ').pop()} ${c2.percentage.toFixed(3)}%`
                          : '—'}
                      </td>
                      <td
                        className="px-3 py-2 font-mono text-[11px] font-semibold"
                        style={{ color: 'var(--c-fuji)' }}
                      >
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
