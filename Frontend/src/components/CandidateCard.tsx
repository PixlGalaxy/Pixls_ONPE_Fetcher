import { Minus, Trophy, Medal, Award, User, ArrowUpRight, ArrowDownRight, Crown } from 'lucide-react';
import { type Candidate, getCandidateKey, getCandidateColor, SHORT_NAMES, CANDIDATE_COLORS, getPartyPhotoUrl, getPartyVisual } from '../types/election';

export interface CandidateTrend {
  pctChange: number;  
  votesChange: number;
}

interface CandidateCardProps {
  candidate: Candidate;
  rank: number;
  trend?: CandidateTrend;
  diffVsPrev?: { votes: number; label: string } | null;
  staggerIdx?: number;
}

const rankIcons = [Trophy, Medal, Award];

export default function CandidateCard({ candidate, rank, trend, diffVsPrev, staggerIdx = 0 }: CandidateCardProps) {
  const key = getCandidateKey(candidate);
  const topColor = getCandidateColor(candidate);
  const topBg = CANDIDATE_COLORS[key]?.bg ?? undefined;
  const shortName = SHORT_NAMES[key] ?? candidate.name.split(' ').slice(-1)[0];
  const isTop = rank === 1;

  const RankIcon = rankIcons[rank - 1] ?? User;

  const visual = getPartyVisual(candidate.party);
  const photoUrl = getPartyPhotoUrl(candidate.party);
  const color = topBg ? topColor : (visual?.primary ?? '#666');
  const bg = topBg ?? (visual ? `${visual.primary}22` : 'rgba(255,255,255,0.05)');
  const borderAccent = topBg ? topColor : (visual?.primary ?? 'var(--border)');

  const trendUp = trend && trend.pctChange > 0;
  const trendDown = trend && trend.pctChange < 0;
  const trendFlat = trend && trend.pctChange === 0;

  function gapColor(votes: number): string {
    if (votes <= 5000) return 'var(--c-nieto)';
    if (votes <= 10000) return 'var(--c-fuji)';
    return 'var(--c-sanch)';
  }
  function gapBg(votes: number): string {
    if (votes <= 5000) return 'rgba(46,205,167,0.12)';
    if (votes <= 10000) return 'rgba(232,148,58,0.12)';
    return 'rgba(224,72,72,0.1)';
  }

  return (
    <div
      className={`flex-1 min-w-[180px] rounded-[var(--radius)] p-3.5 border animate-fade-up stagger-${Math.min(staggerIdx, 5)} transition-all duration-300 hover:scale-[1.02] hover:z-10`}
      style={{
        background: 'var(--bg-card)',
        borderColor: isTop ? borderAccent : 'var(--border)',
        boxShadow: isTop ? `0 0 16px 2px ${borderAccent}33` : undefined,
        ['--glow-color' as string]: isTop ? `${borderAccent}22` : 'transparent',
      }}
    >
      {/* Header: photo/icon + name */}
      <div className="flex items-center gap-2.5 mb-2">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={candidate.party}
            className="w-8 h-8 rounded-md object-cover flex-shrink-0"
            style={{ outline: `2px solid ${borderAccent}`, outlineOffset: '1px' }}
          />
        ) : (
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: bg }}
          >
            <RankIcon size={15} style={{ color }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[9px] truncate" style={{ color }}>
            {rank}° · {candidate.party.length > 22 ? candidate.party.slice(0, 22) + '…' : candidate.party}
          </div>
          <div className="text-[11px] uppercase tracking-wider font-bold truncate" style={{ color }}>
            {shortName}
          </div>
        </div>
      </div>

      {/* Percentage */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="font-mono text-xl font-bold animate-count-up" style={{ color }}>
          {candidate.percentage.toFixed(3)}%
        </span>
      </div>

      {/* Votes */}
      {candidate.votes != null && (
        <div className="text-[11px] font-mono mb-1.5" style={{ color: 'var(--tx2)' }}>
          {candidate.votes.toLocaleString('es-PE')} votos
        </div>
      )}

      {/* Gap to previous rank — colored by proximity */}
      {diffVsPrev && (
        diffVsPrev.label === '1°' && diffVsPrev.votes === 0 ? (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold mb-1.5"
            style={{
              background: 'rgba(255,215,0,0.12)',
              color: '#FFD700',
              borderLeft: '2px solid #FFD700',
            }}
          >
            <Crown size={12} />
            Primero
          </div>
        ) : (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono font-bold mb-1.5"
            style={{
              background: gapBg(Math.abs(diffVsPrev.votes)),
              color: gapColor(Math.abs(diffVsPrev.votes)),
              borderLeft: `2px solid ${gapColor(Math.abs(diffVsPrev.votes))}`,
            }}
          >
            {diffVsPrev.votes < 0 ? '' : '+'}{diffVsPrev.votes.toLocaleString('es-PE')} vs {diffVsPrev.label}
          </div>
        )
      )}

      {/* Trend badge — shows if candidate went up/down since last snapshot */}
      {trend && (
        <div className="flex flex-col gap-1 mt-1 animate-count-up">
          <div className="flex items-center gap-1.5">
            {trendUp && <ArrowUpRight size={12} style={{ color: 'var(--c-nieto)' }} />}
            {trendDown && <ArrowDownRight size={12} style={{ color: 'var(--c-sanch)' }} />}
            {trendFlat && <Minus size={12} style={{ color: 'var(--tx3)' }} />}
            <span
              className="text-[10px] font-mono font-bold"
              style={{
                color: trendUp ? 'var(--c-nieto)' : trendDown ? 'var(--c-sanch)' : 'var(--tx3)',
              }}
            >
              {trend.pctChange > 0 ? '+' : ''}{trend.pctChange.toFixed(3)}%
            </span>
          </div>
          {trend.votesChange !== 0 && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono font-bold"
              style={{
                background: trend.votesChange > 0 ? 'rgba(46,205,167,0.12)' : 'rgba(224,72,72,0.1)',
                color: trend.votesChange > 0 ? 'var(--c-nieto)' : 'var(--c-sanch)',
                borderLeft: `2px solid ${trend.votesChange > 0 ? 'var(--c-nieto)' : 'var(--c-sanch)'}`,
              }}
            >
              {trend.votesChange > 0 ? '+' : ''}{trend.votesChange.toLocaleString('es-PE')} votos
            </div>
          )}
        </div>
      )}
    </div>
  );
}
