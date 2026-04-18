import { useState, useRef } from 'react';
import { X, Download } from 'lucide-react';
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
  const [exporting, setExporting] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const actas = current?.actas;

  async function handleExportMap() {
    if (exporting) return;
    setExporting(true);
    try {
      const svgEl = mapContainerRef.current?.querySelector('svg');
      if (!svgEl) return;

      const MAP_W = 500, MAP_H = 667;
      const PADDING = 28;
      const TOTAL_W = MAP_W + PADDING * 2;
      const top5 = current?.candidates?.slice(0, 5) ?? [];
      const HEADER_H = 90;
      const CAND_H = top5.length > 0 ? 20 + top5.length * 26 + 14 : 0;
      const FOOTER_H = 70;
      const TOTAL_H = PADDING + HEADER_H + MAP_H + CAND_H + FOOTER_H;

      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = TOTAL_W * scale;
      canvas.height = TOTAL_H * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);

      ctx.fillStyle = '#0d0f16';
      ctx.fillRect(0, 0, TOTAL_W, TOTAL_H);

      // Prep SVG clone
      const svgClone = svgEl.cloneNode(true) as SVGElement;
      svgClone.setAttribute('width', String(MAP_W));
      svgClone.setAttribute('height', String(MAP_H));
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgClone.querySelectorAll('.dept-path').forEach(el => {
        const e = el as SVGElement;
        e.style.cssText = '';
        e.setAttribute('stroke', '#0f1117');
        e.setAttribute('stroke-width', '0.5');
        e.setAttribute('opacity', '0.85');
      });
      svgClone.querySelectorAll('.dept-label').forEach(el => {
        const e = el as SVGElement;
        e.style.cssText = '';
        e.setAttribute('opacity', '1');
      });

      const svgBlob = new Blob([new XMLSerializer().serializeToString(svgClone)], {
        type: 'image/svg+xml;charset=utf-8',
      });
      const svgUrl = URL.createObjectURL(svgBlob);
      const mapImg = new Image();
      mapImg.src = svgUrl;
      await new Promise<void>((resolve, reject) => {
        mapImg.onload = () => resolve();
        mapImg.onerror = reject;
        setTimeout(reject, 10000);
      });

      let y = PADDING;

      // Title
      ctx.fillStyle = '#f0f2f8';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillText('Mapa Electoral Perú 2026', PADDING, y + 22);
      y += 30;

      // Subtitle
      ctx.fillStyle = '#6b7080';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.fillText(
        `Resultados parciales ONPE · ${actas?.actas_contabilizadas_pct.toFixed(2) ?? '—'}% de actas contabilizadas`,
        PADDING, y + 14,
      );
      y += 22;

      // Legend
      let lx = PADDING;
      for (const [key, name] of Object.entries(SHORT_NAMES)) {
        const color = CANDIDATE_COLORS[key]?.color ?? '#888';
        ctx.fillStyle = color;
        ctx.fillRect(lx, y + 3, 9, 9);
        ctx.fillStyle = '#9ca0b0';
        ctx.font = '10.5px system-ui, -apple-system, sans-serif';
        ctx.fillText(name, lx + 13, y + 12);
        lx += ctx.measureText(name).width + 28;
      }
      y += 20;

      // Map
      ctx.drawImage(mapImg, PADDING, y, MAP_W, MAP_H);
      URL.revokeObjectURL(svgUrl);
      y += MAP_H + 16;

      // National results
      if (top5.length > 0) {
        ctx.fillStyle = '#4a4f64';
        ctx.font = '9px system-ui, -apple-system, sans-serif';
        ctx.fillText('RESULTADOS NACIONALES', PADDING, y + 10);
        y += 18;

        const maxPct = Math.max(...top5.map(c => c.percentage), 1);
        for (const c of top5) {
          const color = getCandidateColor(c);
          const key = getCandidateKey(c);
          const name = SHORT_NAMES[key] ?? c.name ?? c.party;
          const barFill = (c.percentage / maxPct) * (MAP_W - 70);

          ctx.fillStyle = '#1a1d26';
          ctx.fillRect(PADDING, y, MAP_W, 22);
          ctx.fillStyle = color + '55';
          ctx.fillRect(PADDING, y, barFill, 22);
          ctx.fillStyle = color;
          ctx.fillRect(PADDING, y, 3, 22);

          ctx.fillStyle = '#d0d4e0';
          ctx.font = '11px system-ui, -apple-system, sans-serif';
          ctx.fillText(name, PADDING + 10, y + 15);

          ctx.fillStyle = color;
          ctx.font = 'bold 11px monospace';
          const pctStr = `${c.percentage.toFixed(2)}%`;
          ctx.fillText(pctStr, PADDING + MAP_W - ctx.measureText(pctStr).width - 6, y + 15);
          y += 26;
        }
        y += 8;
      }

      // Divider
      ctx.strokeStyle = '#252836';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(TOTAL_W - PADDING, y);
      ctx.stroke();
      y += 12;

      // Source URL
      ctx.fillStyle = '#4a4f64';
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Extraído de: ${window.location.href}`, PADDING, y + 12);
      y += 22;

      // Footer
      ctx.fillStyle = '#353848';
      ctx.font = '9.5px system-ui, -apple-system, sans-serif';
      ctx.fillText(
        "PIXL's ONPE Fetcher  ·  Developed by PixlGalaxy  ·  © 2026 Fabrizio Gamboa  ·  Hosted on ItzGalaxy.com",
        PADDING, y + 12,
      );

      await new Promise<void>(resolve => {
        canvas.toBlob(blob => {
          if (!blob) { resolve(); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'mapa-electoral-peru-2026.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve();
        }, 'image/png');
      });
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

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
        <button
          onClick={handleExportMap}
          disabled={exporting || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
          style={{ background: 'var(--bg-alt)', borderColor: 'var(--border)', color: 'var(--tx2)' }}
        >
          <Download size={13} />
          {exporting ? 'Exportando...' : 'Exportar mapa'}
        </button>
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
          ref={mapContainerRef}
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
