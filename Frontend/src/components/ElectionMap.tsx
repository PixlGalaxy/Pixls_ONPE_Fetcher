import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import type { RegionSnapshot, Candidate } from '../types/election';
import { getCandidateColor } from '../types/election';

interface ElectionMapProps {
  regions: Record<string, RegionSnapshot>;
  abroad?: RegionSnapshot | null;
  onRegionClick?: (ubigeo: string, data: RegionSnapshot) => void;
}

interface GeoFeature {
  type: string;
  properties: { NOMBDEP: string; FIRST_IDDP: string; [k: string]: unknown };
  geometry: GeoPermissibleObjects;
}

interface GeoJson {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

const DEPT_TO_UBIGEO: Record<string, string> = {
  'AMAZONAS': '010000', 'ANCASH': '020000', 'APURIMAC': '030000',
  'AREQUIPA': '040000', 'AYACUCHO': '050000', 'CAJAMARCA': '060000',
  'CUSCO': '070000', 'HUANCAVELICA': '080000', 'HUANUCO': '090000',
  'ICA': '100000', 'JUNIN': '110000', 'LA LIBERTAD': '120000',
  'LAMBAYEQUE': '130000', 'LIMA': '140000', 'LORETO': '150000',
  'MADRE DE DIOS': '160000', 'MOQUEGUA': '170000', 'PASCO': '180000',
  'PIURA': '190000', 'PUNO': '200000', 'SAN MARTIN': '210000',
  'TACNA': '220000', 'TUMBES': '230000', 'CALLAO': '240000',
  'UCAYALI': '250000',
};

const SMALL_DEPTS: Record<string, { dx: number; dy: number }> = {
  'CALLAO':   { dx: -55, dy: 15 },
  'TUMBES':   { dx: 20, dy: -18 },
  'MOQUEGUA': { dx: 30, dy: 10 },
};

function getWinner(snapshot: RegionSnapshot): Candidate | null {
  if (!snapshot.candidates?.length) return null;
  return snapshot.candidates.reduce((best, c) =>
    c.percentage > best.percentage ? c : best, snapshot.candidates[0]);
}

const STYLE_ID = 'election-map-styles';
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes mapFall {
      0%   { opacity: 0; transform: translateY(-40px) scaleY(.7) }
      65%  { opacity: 1; transform: translateY(7px)   scaleY(1.07) }
      100% { opacity: .85; transform: translateY(0)   scaleY(1) }
    }
    @keyframes fadeUp {
      from { opacity:0; transform: translateY(4px) }
      to   { opacity:1; transform: translateY(0) }
    }
    .dept-path {
      stroke: #0f1117; stroke-width: .5;
      cursor: pointer; transition: opacity .15s, stroke .15s;
      opacity: 0;
      transform-box: fill-box;
      transform-origin: center;
      animation: mapFall .65s cubic-bezier(.34,1.4,.64,1) forwards;
    }
    .dept-path:hover { opacity: .85; stroke: #fff; stroke-width: 1.5 }
    .dept-label { opacity: 0; animation: fadeUp .4s ease forwards }
    .ext-globe  { opacity: 0; animation: fadeUp .6s ease 2s forwards; cursor: pointer }
  `;
  document.head.appendChild(style);
}

const W = 500;
const H = 667;

export default function ElectionMap({ regions, abroad, onRegionClick }: ElectionMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geo, setGeo] = useState<GeoJson | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  useEffect(() => { ensureStyles(); }, []);

  useEffect(() => {
    fetch('/peru-departamentos.geojson')
      .then((r) => r.json())
      .then((d: GeoJson) => setGeo(d))
      .catch(() => {});
  }, []);

  const { projection, pathGen } = useMemo(() => {
    if (!geo) return { projection: null, pathGen: null };
    const margin = W * 0.04;
    const proj = geoMercator().fitExtent(
      [[margin, margin], [W - margin, H - margin]],
      geo as GeoPermissibleObjects
    );
    return { projection: proj, pathGen: geoPath(proj) };
  }, [geo]);

  const handleMouseMove = useCallback((e: React.MouseEvent, name: string) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 30,
        content: name,
      });
    }
  }, []);

  function getRegionColor(ubigeo: string): string {
    const regionData = regions[ubigeo];
    if (!regionData) return '#2a2d38';
    const winner = getWinner(regionData);
    return winner ? getCandidateColor(winner) : '#2a2d38';
  }

  if (!geo || !pathGen || !projection) {
    return (
      <div className="flex items-center justify-center h-80" style={{ color: 'var(--tx3)' }}>
        <svg className="animate-spin mr-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        </svg>
        Cargando mapa...
      </div>
    );
  }

  const featureData = geo.features.map((f, i) => {
    const name = f.properties.NOMBDEP;
    const ubigeo = DEPT_TO_UBIGEO[name] ?? '';
    const d = pathGen(f.geometry as GeoPermissibleObjects) ?? '';
    const centroid = geoCentroid(f as GeoPermissibleObjects);
    const projected = projection(centroid as [number, number]);
    const cx = projected?.[0] ?? 0;
    const cy = projected?.[1] ?? 0;
    const delay = Math.round((cx / W * 0.35 + cy / H * 0.65) * 900);
    return { name, ubigeo, d, cx, cy, i, delay };
  });

  const ext = abroad;
  const extWinner = ext ? getWinner(ext) : null;
  const extColor = extWinner ? getCandidateColor(extWinner) : 'var(--tx3)';

  return (
    <div className="relative w-full" style={{ aspectRatio: `${W}/${H}` }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Department paths */}
        {featureData.map(({ name, ubigeo, d, i, delay }) => (
          <path
            key={ubigeo || `f-${i}`}
            d={d}
            fill={getRegionColor(ubigeo)}
            className="dept-path"
            style={{ animationDelay: `${delay}ms` }}
            onMouseMove={(e) => handleMouseMove(e, name)}
            onMouseLeave={() => setTooltip(null)}
            onClick={() => {
              const regionData = regions[ubigeo];
              if (regionData && onRegionClick) onRegionClick(ubigeo, regionData);
            }}
          />
        ))}

        {/* Department % labels */}
        <g className="dept-labels">
          {featureData.map(({ name, ubigeo, cx, cy, delay }) => {
            const regionData = regions[ubigeo];
            const pct = regionData?.actas?.actas_contabilizadas_pct;
            if (pct == null) return null;

            const pctText = Math.round(pct) + '%';
            const small = SMALL_DEPTS[name];
            const labelDelay = `${delay + 200}ms`;
            const fontSize = 8.5;

            if (small) {
              const tx = cx + small.dx;
              const ty = cy + small.dy;
              return (
                <g key={`lbl-${ubigeo}`} className="dept-label" style={{ animationDelay: labelDelay }}>
                  <line
                    x1={cx} y1={cy} x2={tx} y2={ty}
                    stroke="rgba(255,255,255,.4)" strokeWidth={0.7}
                  />
                  <circle cx={cx} cy={cy} r={2} fill="rgba(255,255,255,.5)" />
                  <text
                    x={tx} y={ty + 3}
                    textAnchor={small.dx < 0 ? 'end' : 'start'}
                    fontSize={fontSize} fontFamily='"DM Mono", monospace'
                    fontWeight={600} fill="#fff"
                    paintOrder="stroke" stroke="#0f1117" strokeWidth={2.5}
                    pointerEvents="none"
                  >
                    {pctText}
                  </text>
                </g>
              );
            }

            return (
              <text
                key={`lbl-${ubigeo}`}
                className="dept-label"
                style={{ animationDelay: labelDelay }}
                x={cx} y={cy + 3}
                textAnchor="middle"
                fontSize={fontSize} fontFamily='"DM Mono", monospace'
                fontWeight={600} fill="#fff"
                paintOrder="stroke" stroke="rgba(15,17,23,.7)" strokeWidth={2.5}
                pointerEvents="none"
              >
                {pctText}
              </text>
            );
          })}
        </g>
      </svg>

      {/* Extranjero icon overlay */}
      {ext && (
        <button
          onClick={() => onRegionClick?.('abroad', { ...ext, scope: 'region:abroad:Extranjero' })}
          className="absolute z-10 transition-all hover:opacity-90 active:scale-95 flex flex-col items-center gap-1"
          style={{
            left: '14%',
            top: '54%',
            transform: 'translate(-50%, -50%)',
          }}
          title="Extranjero"
        >
          <Globe
            size={40}
            style={{
              color: extColor,
              filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))',
            }}
          />
          <div className="text-center">
            <div className="text-[10px] font-semibold" style={{ color: extColor }}>
              Extranjero
            </div>
            <div className="font-mono text-[9px]" style={{ color: extColor }}>
              {ext.actas?.actas_contabilizadas_pct.toFixed(1)}%
            </div>
          </div>
        </button>
      )}

      {tooltip && (
        <div
          className="absolute pointer-events-none px-2 py-1 rounded text-[11px] font-semibold"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--tx1)',
            transform: 'translateX(-50%)',
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
