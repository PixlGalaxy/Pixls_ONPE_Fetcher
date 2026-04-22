import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { type Timeline, SHORT_NAMES, getCandidateColorByKey } from '../types/election';

interface Props {
  timeline: Timeline;
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#1C1E23',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '10px 14px',
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
};

function CandidateTooltip({
  active,
  payload,
  label,
  candidateKeys,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: number;
  candidateKeys: string[];
}) {
  if (!active || !payload?.length) return null;

  const sorted = [...candidateKeys].sort((a, b) => {
    const av = payload.find((p) => p.dataKey === a)?.value ?? 0;
    const bv = payload.find((p) => p.dataKey === b)?.value ?? 0;
    return bv - av;
  });

  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ color: '#8A8F98', marginBottom: 6, fontSize: 10 }}>
        {Number(label).toFixed(2)}% actas
      </div>
      {sorted.map((key) => {
        const entry = payload.find((p) => p.dataKey === key);
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 20,
              color: getCandidateColorByKey(key),
              marginBottom: 2,
            }}
          >
            <span>{SHORT_NAMES[key] ?? key}</span>
            <span style={{ fontWeight: 600 }}>{(entry?.value ?? 0).toFixed(3)}%</span>
          </div>
        );
      })}
    </div>
  );
}

export default function TimelineChart({ timeline }: Props) {
  const candidateKeys = useMemo(
    () => Object.keys(timeline.cuts[0]?.candidates ?? {}),
    [timeline],
  );

  const { data, yMin, yMax } = useMemo(() => {
    const raw = timeline.cuts.map((cut) => {
      const point: Record<string, number> = { actas_pct: cut.actas_pct };
      for (const key of candidateKeys) {
        point[key] = cut.candidates[key] ?? 0;
      }
      return point;
    });
    const deduped = new Map<number, Record<string, number>>();
    for (const d of [...raw].sort((a, b) => a.actas_pct - b.actas_pct)) {
      deduped.set(d.actas_pct, d);
    }
    const points = [...deduped.values()];
    let globalMin = Infinity;
    let globalMax = -Infinity;
    for (const point of points) {
      for (const key of candidateKeys) {
        const v = point[key] ?? 0;
        if (v > 0 && v < globalMin) globalMin = v;
        if (v > globalMax) globalMax = v;
      }
    }
    return {
      data: points,
      yMin: globalMin === Infinity ? 0 : Math.floor((globalMin - 1.0) * 10) / 10,
      yMax: globalMax === -Infinity ? 'auto' : Math.ceil((globalMax + 2.5) * 10) / 10,
    };
  }, [timeline, candidateKeys]);

  return (
    <div
      className="rounded-[var(--radius)] p-4 border animate-fade-up"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <h3 className="text-[13px] font-semibold mb-4" style={{ color: 'var(--tx2)' }}>
        Evolución del conteo — % por candidato
      </h3>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="actas_pct"
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
            tick={{ fill: '#8A8F98', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
            stroke="rgba(255,255,255,0.08)"
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
            tick={{ fill: '#8A8F98', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
            stroke="rgba(255,255,255,0.08)"
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            content={(props) => (
              <CandidateTooltip
                active={props.active}
                payload={props.payload as unknown as { dataKey: string; value: number }[]}
                label={props.label as number}
                candidateKeys={candidateKeys}
              />
            )}
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
          />
          {candidateKeys.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={getCandidateColorByKey(key)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: getCandidateColorByKey(key) }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-3 mt-3">
        {candidateKeys.map((key) => (
          <div
            key={key}
            className="flex items-center gap-1.5 text-[10px]"
            style={{ color: 'var(--tx2)' }}
          >
            <div className="w-3 h-[2px] rounded-full" style={{ background: getCandidateColorByKey(key) }} />
            {SHORT_NAMES[key] ?? key}
          </div>
        ))}
      </div>
    </div>
  );
}
