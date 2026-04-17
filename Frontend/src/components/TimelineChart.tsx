import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, type ISeriesApi, ColorType } from 'lightweight-charts';
import { type Timeline, SHORT_NAMES, getCandidateColorByKey } from '../types/election';

interface TimelineChartProps {
  timeline: Timeline;
}

export default function TimelineChart({ timeline }: TimelineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'>[]>([]);

  const candidateKeys = Object.keys(timeline.cuts[0]?.candidates ?? {});

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = [];
    }

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8A8F98',
        fontFamily: 'DM Mono, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(255,255,255,0.1)', width: 1, labelBackgroundColor: '#1C1E23' },
        horzLine: { color: 'rgba(255,255,255,0.1)', width: 1, labelBackgroundColor: '#1C1E23' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        tickMarkFormatter: (time: number) => `${time.toFixed(0)}%`,
      },
      localization: {
        priceFormatter: (price: number) => `${price.toFixed(3)}%`,
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    for (const key of candidateKeys) {
      const color = getCandidateColorByKey(key);
      const series = chart.addLineSeries({
        color,
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
      seriesRef.current.push(series);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = [];
    };
  }, [timeline, candidateKeys.join(',')]);

  return (
    <div
      className="rounded-[var(--radius)] p-4 border animate-fade-up"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--tx2)' }}>
        Evolución del conteo — % por candidato
      </h3>
      <div ref={containerRef} style={{ width: '100%', height: 360 }} />

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
