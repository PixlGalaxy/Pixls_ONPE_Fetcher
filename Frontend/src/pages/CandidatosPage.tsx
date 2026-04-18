import { useState } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import SeoBlock from '../components/SeoBlock';
import { useElectionData } from '../hooks/useElectionData';
import {
  type Candidate,
  getCandidateKey,
  getCandidateColor,
  SHORT_NAMES,
  CANDIDATE_COLORS,
  getPartyPhotoUrl,
  getPartyVisual,
} from '../types/election';

type SortField = 'rank' | 'name' | 'votes' | 'percentage';

export default function CandidatosPage() {
  const { current, loading } = useElectionData();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('rank');
  const [sortAsc, setSortAsc] = useState(true);

  const allCandidates = current?.candidates ?? [];
  const actas = current?.actas;

  const first = allCandidates[0];

  const filtered = allCandidates.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.party.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'rank': cmp = a.rank - b.rank; break;
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'votes': cmp = (a.votes ?? 0) - (b.votes ?? 0); break;
      case 'percentage': cmp = a.percentage - b.percentage; break;
    }
    return sortAsc ? cmp : -cmp;
  });

  function toggleSort(field: SortField) {
    if (sortBy === field) setSortAsc(!sortAsc);
    else { setSortBy(field); setSortAsc(field === 'rank'); }
  }

  function diffFromFirst(c: Candidate): { votes: number | null; pct: number } {
    if (!first || c.candidate_id === first.candidate_id) return { votes: null, pct: 0 };
    const vDiff = first.votes != null && c.votes != null ? first.votes - c.votes : null;
    return { votes: vDiff, pct: first.percentage - c.percentage };
  }

  const maxVotes = allCandidates[0]?.votes ?? 1;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--tx1)' }}>
            Todos los Candidatos
          </h2>
          <p className="text-[11px]" style={{ color: 'var(--tx3)' }}>
            {allCandidates.length} candidatos — {actas?.actas_contabilizadas_pct.toFixed(2) ?? '...'}% actas contabilizadas
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border"
          style={{ background: 'var(--bg-alt)', borderColor: 'var(--border)' }}
        >
          <Search size={14} style={{ color: 'var(--tx3)' }} />
          <input
            type="text"
            placeholder="Buscar candidato o partido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-[12px] outline-none w-48"
            style={{ color: 'var(--tx1)' }}
          />
        </div>
      </div>

      {/* ══════════ Table ══════════ */}
      <div
        className="rounded-[var(--radius)] border overflow-hidden animate-fade-up"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {loading && allCandidates.length === 0 ? (
          <div className="p-8 text-center text-[13px]" style={{ color: 'var(--tx3)' }}>
            Cargando candidatos...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ background: 'var(--bg-alt)' }}>
                  {([
                    { field: 'rank' as SortField, label: '#', w: 'w-10' },
                    { field: 'name' as SortField, label: 'Candidato', w: '' },
                    { field: 'percentage' as SortField, label: '%', w: 'w-20' },
                    { field: 'votes' as SortField, label: 'Votos', w: 'w-28' },
                  ]).map(({ field, label, w }) => (
                    <th
                      key={field}
                      className={`px-3 py-2 text-[10px] uppercase tracking-wide font-semibold cursor-pointer select-none ${w}`}
                      style={{ color: 'var(--tx3)' }}
                      onClick={() => toggleSort(field)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        <ArrowUpDown size={10} style={{ opacity: sortBy === field ? 1 : 0.3 }} />
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold w-28" style={{ color: 'var(--tx3)' }}>
                    Barra
                  </th>
                  <th className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold w-32" style={{ color: 'var(--tx3)' }}>
                    Dif. con 1°
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const key = getCandidateKey(c);
                  const color = getCandidateColor(c);
                  const barColor = CANDIDATE_COLORS[key]?.color ?? getPartyVisual(c.party)?.primary ?? 'var(--tx3)';
                  const barWidth = maxVotes > 0 ? ((c.votes ?? 0) / maxVotes) * 100 : 0;
                  const diff = diffFromFirst(c);
                  const shortName = SHORT_NAMES[key];

                  return (
                    <tr
                      key={c.candidate_id}
                      className="border-t transition-colors hover:bg-white/[0.02]"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td className="px-3 py-2.5 font-mono text-[12px] font-bold" style={{ color: 'var(--tx3)' }}>
                        {c.rank}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {getPartyPhotoUrl(c.party) ? (
                            <img
                              src={getPartyPhotoUrl(c.party)!}
                              alt={c.party}
                              className="w-7 h-7 rounded-md object-cover flex-shrink-0"
                              style={{ outline: `1px solid ${getPartyVisual(c.party)?.primary ?? color}`, outlineOffset: '1px' }}
                            />
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                          )}
                          <div>
                            <div className="text-[12px] font-semibold" style={{ color: 'var(--tx1)' }}>
                              {shortName ? `${shortName} ` : ''}{c.name}
                            </div>
                            <div className="text-[10px]" style={{ color: 'var(--tx3)' }}>{c.party}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[13px] font-semibold" style={{ color }}>
                        {c.percentage.toFixed(3)}%
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px]" style={{ color: 'var(--tx2)' }}>
                        {c.votes?.toLocaleString('es-PE') ?? '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="h-2.5 rounded-sm overflow-hidden" style={{ background: 'var(--bg-alt)' }}>
                          <div
                            className="h-full rounded-sm transition-all duration-500"
                            style={{ width: `${barWidth}%`, background: barColor, opacity: 0.7 }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px]">
                        {diff.votes == null ? (
                          <span style={{ color: getCandidateColor(c) }}>— Líder</span>
                        ) : (
                          <div>
                            <span style={{ color: 'var(--c-sanch)' }}>
                              -{diff.votes.toLocaleString('es-PE')}
                            </span>
                            <span className="ml-1.5" style={{ color: 'var(--tx3)' }}>
                              ({diff.pct.toFixed(3)}%)
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length === 0 && allCandidates.length > 0 && (
        <div className="text-center py-6 text-[13px]" style={{ color: 'var(--tx3)' }}>
          No se encontraron candidatos para "{search}"
        </div>
      )}
      <SeoBlock>
        <h1>Candidatos Presidenciales Perú 2026</h1>
        <p>
          Consulta la lista completa de candidatos presidenciales de las elecciones Perú 2026 con sus
          votos actualizados, porcentaje obtenido y partido político. Datos oficiales de la ONPE en
          tiempo real.
        </p>
        <h2>Información disponible por candidato</h2>
        <ul>
          <li>Número de votos obtenidos</li>
          <li>Porcentaje de votación</li>
          <li>Partido político</li>
          <li>Posición en el ranking electoral</li>
        </ul>
      </SeoBlock>
    </div>
  );
}
