import { useState } from 'react';
import { X } from 'lucide-react';
import SeoBlock from '../components/SeoBlock';
import ElectionMap from '../components/ElectionMap';
import { useElectionData } from '../hooks/useElectionData';
import {
  type RegionSnapshot,
  type Candidate,
  getCandidateColor,
  getCandidateKey,
  SHORT_NAMES,
  CANDIDATE_COLORS,
  getPartyPhotoUrl,
} from '../types/election';

interface ModalData {
  ubigeo: string;
  data: RegionSnapshot;
}

export default function MapPage() {
  const { regions, abroad, current, loading } = useElectionData();
  const [modal, setModal] = useState<ModalData | null>(null);

  const actas = current?.actas;

  function regionName(data: RegionSnapshot): string {
    const parts = data.scope?.split(':') ?? [];
    return parts[2] ?? parts[1] ?? 'Región';
  }

  return (
    <div className="space-y-4 pt-4">
      {/* ══════════ Header ══════════ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--tx1)' }}>
            Mapa Electoral
          </h2>
          <p className="text-[11px]" style={{ color: 'var(--tx3)' }}>
            Ganador por region ({actas?.actas_contabilizadas_pct.toFixed(2) ?? '...'}%)
          </p>
        </div>
      </div>

      {/* ══════════ Legend ══════════ */}
      <div className="flex flex-wrap gap-3 animate-fade-up">
        {Object.entries(SHORT_NAMES).map(([key, name]) => (
          <div key={key} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--tx2)' }}>
            <div className="w-2 h-2 rounded-sm" style={{ background: CANDIDATE_COLORS[key]?.color }} />
            {name}
          </div>
        ))}
      </div>

      {/* ══════════ Votos Info ══════════ */}
      {actas && (
        <div
          className="grid grid-cols-2 gap-3 animate-fade-up"
        >
          <div
            className="rounded-[var(--radius)] p-4 border text-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--tx3)' }}>
              Votos Contabilizados
            </div>
            <div className="text-lg font-mono font-bold" style={{ color: 'var(--tx1)' }}>
              {(actas.total_valid_votes ?? 0).toLocaleString('es-PE')}
            </div>
          </div>
          <div
            className="rounded-[var(--radius)] p-4 border text-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--tx3)' }}>
              Votos por Contabilizar (est.)
            </div>
            <div className="text-lg font-mono font-bold" style={{ color: 'var(--c-fuji)' }}>
              {actas.actas_contabilizadas_pct > 0 && (actas.total_valid_votes ?? 0) > 0
                ? Math.round((actas.total_valid_votes ?? 0) / (actas.actas_contabilizadas_pct / 100) - (actas.total_valid_votes ?? 0)).toLocaleString('es-PE')
                : '...'}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Map + Region List ══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:items-start">
        {/* Map Card */}
        <div
          className="rounded-[var(--radius)] p-4 border animate-fade-up lg:col-span-1"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', aspectRatio: '500 / 699' }}
        >
          {loading && Object.keys(regions).length === 0 ? (
            <div className="flex items-center justify-center h-80" style={{ color: 'var(--tx3)' }}>
              Cargando mapa...
            </div>
          ) : (
            <ElectionMap
              regions={regions}
              abroad={abroad}
              onRegionClick={(ubigeo, data) => setModal({ ubigeo, data })}
            />
          )}
        </div>

        {/* Region List Card – match map aspect ratio (500×667 + padding) */}
        <div
          className="rounded-[var(--radius)] p-4 border animate-fade-up flex flex-col overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', aspectRatio: '500 / 699' }}
        >
          <h3 className="text-[13px] font-semibold mb-3 flex-shrink-0" style={{ color: 'var(--tx2)' }}>
            Resultados por departamento
          </h3>
          <div className="space-y-1.5 overflow-y-auto flex-1">
            {Object.entries(regions)
              .sort(([, a], [, b]) => regionName(a).localeCompare(regionName(b)))
              .map(([ubigeo, data]) => {
                const winner = data.candidates?.[0];
                const winnerColor = winner ? getCandidateColor(winner) : 'var(--tx3)';
                const winnerKey = winner ? getCandidateKey(winner) : '';
                const pct = data.actas?.actas_contabilizadas_pct ?? 0;

                return (
                  <button
                    key={ubigeo}
                    onClick={() => setModal({ ubigeo, data })}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md border text-left transition-all hover:opacity-80"
                    style={{ background: 'var(--bg-alt)', borderColor: 'var(--border)' }}
                  >
                    {winner && getPartyPhotoUrl(winner.party) ? (
                      <img
                        src={getPartyPhotoUrl(winner.party)!}
                        alt={winner.party}
                        className="w-7 h-7 rounded-md object-cover flex-shrink-0"
                        style={{ outline: `1px solid ${winnerColor}`, outlineOffset: '1px' }}
                      />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: winnerColor }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--tx1)' }}>
                        {regionName(data)}
                      </div>
                      <div className="text-[10px] font-mono" style={{ color: 'var(--tx3)' }}>
                        {pct.toFixed(1)}% actas · Líder: {SHORT_NAMES[winnerKey] ?? winner?.name?.split(' ').pop() ?? '—'}
                      </div>
                    </div>
                    <div className="font-mono text-[12px] font-semibold" style={{ color: winnerColor }}>
                      {winner?.percentage.toFixed(2) ?? '—'}%
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* ══════════ Region Modal ══════════ */}
      {modal && (() => {
        const md = modal.data;
        const ma = md.actas;
        const votosContados = ma?.total_votes_cast ?? 0;
        const pctActas = ma?.actas_contabilizadas_pct ?? 0;
        const votosPendientes = pctActas > 0 && votosContados > 0
          ? Math.round(votosContados / (pctActas / 100) - votosContados)
          : null;
        const top5 = md.candidates?.slice(0, 5) ?? [];
        const maxPct = top5.length ? Math.max(...top5.map(c => c.percentage)) : 1;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-5"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setModal(null)}
          >
            <div
              className="relative w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-xl border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header band ── */}
              <div className="px-5 pt-5 pb-3">
                <button
                  onClick={() => setModal(null)}
                  className="absolute top-3 right-3.5 p-1 rounded hover:bg-white/5 transition"
                  style={{ color: 'var(--tx3)' }}
                >
                  <X size={16} />
                </button>

                <h3 className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--tx1)' }}>
                  {regionName(md)}
                </h3>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--tx3)' }}>
                  ONPE parcial · {pctActas.toFixed(1)}% actas
                </p>

                {/* Actas progress bar */}
                <div className="mt-3 h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(pctActas, 100)}%`,
                      background: 'linear-gradient(90deg, var(--c-rla), var(--c-nieto))',
                    }}
                  />
                </div>
              </div>

              {/* ── Stats row ── */}
              <div
                className="mx-5 mb-4 grid grid-cols-3 gap-2 rounded-lg px-3 py-2.5 text-center"
                style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}
              >
                <div>
                  <div className="font-mono text-[13px] font-bold" style={{ color: 'var(--c-nieto)' }}>
                    {votosContados.toLocaleString('es-PE')}
                  </div>
                  <div className="text-[8px] mt-0.5" style={{ color: 'var(--tx3)' }}>contabilizados</div>
                </div>
                <div>
                  <div className="font-mono text-[13px] font-bold" style={{ color: 'var(--c-sanch)' }}>
                    {votosPendientes != null ? `~${votosPendientes.toLocaleString('es-PE')}` : '—'}
                  </div>
                  <div className="text-[8px] mt-0.5" style={{ color: 'var(--tx3)' }}>pendientes (est.)</div>
                </div>
                <div>
                  <div className="font-mono text-[13px] font-bold" style={{ color: 'var(--c-fuji)' }}>
                    {(ma?.actas_enviadas_jee ?? 0).toLocaleString('es-PE')}
                  </div>
                  <div className="text-[8px] mt-0.5" style={{ color: 'var(--tx3)' }}>en JEE</div>
                </div>
              </div>

              {/* Actas count line */}
              <div className="px-5 mb-3 text-[10px] font-mono" style={{ color: 'var(--tx3)' }}>
                {(ma?.actas_contabilizadas ?? 0).toLocaleString('es-PE')} de {(ma?.actas_total ?? 0).toLocaleString('es-PE')} actas procesadas
              </div>

              {/* ── Top 5 candidates ── */}
              <div className="px-5 pb-5 space-y-1">
                {top5.map((c: Candidate, ci: number) => {
                  const color = getCandidateColor(c);
                  const key = getCandidateKey(c);
                  const barW = maxPct > 0 ? (c.percentage / maxPct) * 100 : 0;

                  return (
                    <div
                      key={c.candidate_id}
                      className="relative flex items-center gap-3 rounded-md px-3 py-2"
                      style={{ background: ci === 0 ? color + '12' : 'transparent' }}
                    >
                      {/* Rank */}
                      <span className="font-mono text-[10px] w-3 text-center flex-shrink-0" style={{ color: 'var(--tx3)' }}>
                        {ci + 1}
                      </span>
                      {/* Color dot */}
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      {/* Name + bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between mb-0.5">
                          <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--tx1)' }}>
                            {SHORT_NAMES[key] || c.name || c.party}
                          </span>
                          <span className="font-mono text-[12px] font-bold ml-2 flex-shrink-0" style={{ color }}>
                            {c.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-[4px] rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${barW}%`, background: color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
      <SeoBlock>
        <h1>Mapa Electoral Perú 2026</h1>
        <p>
          Visualiza en un mapa interactivo los resultados de las elecciones presidenciales Perú 2026
          por departamento y región. Consulta qué candidato lidera en cada zona del país según los
          datos oficiales de la ONPE.
        </p>
        <h2>Datos disponibles en el mapa electoral</h2>
        <ul>
          <li>Resultados por departamento</li>
          <li>Porcentaje de votos por región</li>
          <li>Actas contabilizadas por zona</li>
          <li>Candidato líder por área geográfica</li>
        </ul>
      </SeoBlock>
    </div>
  );
}
