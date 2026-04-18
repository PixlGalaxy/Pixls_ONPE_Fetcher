import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export interface DiffItem {
  actas_pct: number;
  diff_1v2: number;
  diff_2v3: number;
  diff_3v4: number;
}

const DIFF_SERIES = [
  { key: 'diff_1v2' as const, label: '1° vs 2°', color: '#E8943A' },
  { key: 'diff_2v3' as const, label: '2° vs 3°', color: '#4A90D9' },
  { key: 'diff_3v4' as const, label: '3° vs 4°', color: '#B07CD8' },
];

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#1C1E23',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '10px 14px',
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
};

function DiffTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ color: '#8A8F98', marginBottom: 6, fontSize: 10 }}>
        {Number(label).toFixed(2)}% actas
      </div>
      {DIFF_SERIES.map((cfg) => {
        const entry = payload.find((p) => p.dataKey === cfg.key);
        return (
          <div
            key={cfg.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 20,
              color: cfg.color,
              marginBottom: 2,
            }}
          >
            <span>{cfg.label}</span>
            <span style={{ fontWeight: 600 }}>{(entry?.value ?? 0).toFixed(3)} pp</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DiffEvolutionChart({ diffData }: { diffData: DiffItem[] }) {
  const data = useMemo(() => {
    const deduped = new Map<number, DiffItem>();
    for (const d of [...diffData].sort((a, b) => a.actas_pct - b.actas_pct)) {
      deduped.set(d.actas_pct, d);
    }
    return [...deduped.values()];
  }, [diffData]);

  return (
    <div
      className="rounded-[var(--radius)] p-4 border animate-fade-up"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <h3
        className="text-[13px] font-semibold mb-4 flex items-center gap-2"
        style={{ color: 'var(--tx2)' }}
      >
        <TrendingUp size={14} style={{ color: 'var(--c-fuji)' }} />
        Diferencia entre posiciones (puntos porcentuales)
      </h3>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <defs>
            {DIFF_SERIES.map((cfg) => (
              <linearGradient key={cfg.key} id={`grad-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cfg.color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={cfg.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
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
            tickFormatter={(v) => `${Number(v).toFixed(1)}`}
            tick={{ fill: '#8A8F98', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
            stroke="rgba(255,255,255,0.08)"
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            content={(props) => (
              <DiffTooltip
                active={props.active}
                payload={props.payload as unknown as { dataKey: string; value: number }[]}
                label={props.label as number}
              />
            )}
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
          />
          {DIFF_SERIES.map((cfg) => (
            <Area
              key={cfg.key}
              type="monotone"
              dataKey={cfg.key}
              stroke={cfg.color}
              strokeWidth={2}
              fill={`url(#grad-${cfg.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: cfg.color }}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-4 mt-3">
        {DIFF_SERIES.map((cfg) => (
          <div
            key={cfg.key}
            className="flex items-center gap-1.5 text-[10px]"
            style={{ color: 'var(--tx2)' }}
          >
            <div className="w-3 h-[2px] rounded-full" style={{ background: cfg.color }} />
            {cfg.label}
          </div>
        ))}
      </div>
    </div>
  );
}
