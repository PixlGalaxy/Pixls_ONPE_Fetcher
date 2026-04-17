export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export interface Actas {
  actas_contabilizadas_pct: number;
  actas_contabilizadas: number;
  actas_total: number;
  actas_pendientes: number;
  actas_enviadas_jee: number;
  actas_pendientes_jee: number | null;
  total_votes_cast: number | null;
  total_valid_votes: number | null;
  citizen_participation_pct: number | null;
}

export interface Candidate {
  rank: number;
  candidate_id: string;
  name: string;
  party: string;
  party_id: string | null;
  votes: number | null;
  percentage: number;
}

export interface Snapshot {
  election: string;
  label: string;
  scope: string;
  snapshot_time: string;
  source?: string;
  actas: Actas;
  candidates: Candidate[];
}

export interface TimelineCut {
  ts: string;
  actas_pct: number;
  contabilizadas: number;
  jee: number;
  votos_emitidos: number;
  candidates: Record<string, number>;
}

export interface Timeline {
  description: string;
  total_actas: number;
  candidate_info: Record<string, { candidate_id: string; name: string; party: string }>;
  cuts_count: number;
  cuts: TimelineCut[];
}

export interface RegionSnapshot extends Snapshot {
}

export interface SchedulerInfo {
  poll_interval_seconds: number;
  last_check_time: string | null;
  next_check_time: string | null;
  last_change_detected: string | null;
  is_running: boolean;
}

export interface StatusMeta {
  last_full_fetch: string | null;
  scheduler?: SchedulerInfo;
  elections: Record<string, {
    last_actas_pct: number | null;
    last_snapshot_time: string | null;
    snapshot_count: number;
  }>;
}

// ── Candidate colors (matching the index.html theme) ──────────────────
export const CANDIDATE_COLORS: Record<string, { color: string; bg: string }> = {
  'fuji':  { color: '#E8943A', bg: 'rgba(232,148,58,0.15)' },
  'rla':   { color: '#4A90D9', bg: 'rgba(74,144,217,0.15)' },
  'nieto': { color: '#E6B41A', bg: 'rgba(230,180,26,0.15)' },
  'belm':  { color: '#B07CD8', bg: 'rgba(176,124,216,0.15)' },
  'sanch': { color: '#E04848', bg: 'rgba(224,72,72,0.15)' },
};

// Map candidate_id → short key
export const ID_TO_KEY: Record<string, string> = {
  '10001088': 'fuji',
  '07845838': 'rla',
  '06506278': 'nieto',
  '09177250': 'belm',
  '16002918': 'sanch',
};

// Map party name → short key (for abroad data where candidate_id/name are empty)
export const PARTY_TO_KEY: Record<string, string> = {
  'FUERZA POPULAR': 'fuji',
  'RENOVACIÓN POPULAR': 'rla',
  'PARTIDO DEL BUEN GOBIERNO': 'nieto',
  'PARTIDO CÍVICO OBRAS': 'belm',
  'JUNTOS POR EL PERÚ': 'sanch',
};

// Short display names
export const SHORT_NAMES: Record<string, string> = {
  'fuji': 'Fujimori',
  'rla': 'López Aliaga',
  'nieto': 'Nieto',
  'belm': 'Belmont',
  'sanch': 'Sánchez',
};

export function getCandidateKey(candidate: Candidate): string {
  if (candidate.candidate_id && ID_TO_KEY[candidate.candidate_id]) {
    return ID_TO_KEY[candidate.candidate_id];
  }
  if (candidate.party && PARTY_TO_KEY[candidate.party]) {
    return PARTY_TO_KEY[candidate.party];
  }
  return candidate.candidate_id || candidate.party || '';
}

export function getCandidateColor(candidate: Candidate): string {
  const key = getCandidateKey(candidate);
  return CANDIDATE_COLORS[key]?.color ?? '#666';
}

export function getCandidateColorByKey(key: string): string {
  return CANDIDATE_COLORS[key]?.color ?? '#666';
}

// ── Party → photo file + dominant colors ──────────────────
export interface PartyVisual {
  file: string;
  primary: string;
  secondary: string;
}

export const PARTY_VISUALS: Record<string, PartyVisual> = {
  'ALIANZA PARA EL PROGRESO':                                    { file: '00000001.jpg', primary: '#1050A0', secondary: '#E03030' },
  'AHORA NACIÓN - AN':                                           { file: '00000002.jpg', primary: '#E00000', secondary: '#D02020' },
  'ALIANZA ELECTORAL VENCEREMOS':                                 { file: '00000003.jpg', primary: '#B01020', secondary: '#408030' },
  'PERÚ MODERNO':                                                 { file: '00000004.jpg', primary: '#E00070', secondary: '#F0F000' },
  'FE EN EL PERÚ':                                                { file: '00000005.jpg', primary: '#30A030', secondary: '#30A030' },
  'FRENTE POPULAR AGRÍCOLA FIA DEL PERÚ':                         { file: '00000006.jpg', primary: '#000090', secondary: '#7070C0' },
  'AVANZA PAÍS - PARTIDO DE INTEGRACIÓN SOCIAL':                  { file: '00000007.jpg', primary: '#203080', secondary: '#405090' },
  'FUERZA POPULAR':                                               { file: '00000008.jpg', primary: '#E06000', secondary: '#E06000' },
  'FUERZA Y LIBERTAD':                                            { file: '00000009.jpg', primary: '#0000F0', secondary: '#E01010' },
  'JUNTOS POR EL PERÚ':                                           { file: '00000010.jpg', primary: '#50B010', secondary: '#E00000' },
  'LIBERTAD POPULAR':                                             { file: '00000011.jpg', primary: '#F0F000', secondary: '#202000' },
  'PARTIDO APRISTA PERUANO':                                      { file: '00000012.jpg', primary: '#F00000', secondary: '#F0D0D0' },
  'CIUDADANOS POR EL PERÚ':                                       { file: '00000013.jpg', primary: '#F00000', secondary: '#F06060' },
  'PARTIDO CÍVICO OBRAS':                                         { file: '00000014.jpg', primary: '#004000', secondary: '#D0D0D0' },
  'PARTIDO DE LOS TRABAJADORES Y EMPRENDEDORES PTE - PERÚ':       { file: '00000015.jpg', primary: '#304090', secondary: '#F0D050' },
  'PARTIDO DEL BUEN GOBIERNO':                                    { file: '00000016.jpg', primary: '#F00000', secondary: '#F0D010' },
  'PARTIDO DEMÓCRATA UNIDO PERÚ':                                 { file: '00000017.jpg', primary: '#00A030', secondary: '#B0E0C0' },
  'PARTIDO DEMÓCRATA VERDE':                                      { file: '00000018.jpg', primary: '#00A050', secondary: '#C0E0D0' },
  'PARTIDO DEMOCRATICO FEDERAL':                                  { file: '00000019.jpg', primary: '#009030', secondary: '#D00000' },
  'PARTIDO DEMOCRÁTICO SOMOS PERÚ':                               { file: '00000020.jpg', primary: '#F01020', secondary: '#104080' },
  'PARTIDO FRENTE DE LA ESPERANZA 2021':                          { file: '00000021.jpg', primary: '#60B050', secondary: '#D0D0D0' },
  'PARTIDO MORADO':                                               { file: '00000022.jpg', primary: '#401070', secondary: '#9070B0' },
  'PARTIDO PAÍS PARA TODOS':                                      { file: '00000023.jpg', primary: '#F0C000', secondary: '#303030' },
  'PARTIDO PATRIÓTICO DEL PERÚ':                                  { file: '00000024.jpg', primary: '#202020', secondary: '#D0D0D0' },
  'PARTIDO POLÍTICO COOPERACIÓN POPULAR':                         { file: '00000025.jpg', primary: '#E03030', secondary: '#00A050' },
  'PARTIDO POLÍTICO INTEGRIDAD DEMOCRÁTICA':                      { file: '00000026.jpg', primary: '#4080A0', secondary: '#C0D0E0' },
  'PARTIDO POLÍTICO NACIONAL PERÚ LIBRE':                         { file: '00000027.jpg', primary: '#E00000', secondary: '#F0B000' },
  'PARTIDO POLÍTICO PERÚ ACCIÓN':                                 { file: '00000028.jpg', primary: '#000070', secondary: '#E00000' },
  'PARTIDO POLÍTICO PERÚ PRIMERO':                                { file: '00000029.jpg', primary: '#D00010', secondary: '#E08080' },
  'PARTIDO POLÍTICO PRIN':                                        { file: '00000030.jpg', primary: '#E00000', secondary: '#F0D0D0' },
  'PARTIDO SICREO':                                               { file: '00000031.jpg', primary: '#E00010', secondary: '#E0E0E0' },
  'PODEMOS PERÚ':                                                 { file: '00000032.jpg', primary: '#004090', secondary: '#F0B0B0' },
  'PRIMERO LA GENTE – COMUNIDAD, ECOLOGÍA, LIBERTAD Y PROGRESO':  { file: '00000033.jpg', primary: '#70D050', secondary: '#0030C0' },
  'PROGRESEMOS':                                                  { file: '00000034.jpg', primary: '#20B020', secondary: '#F0F000' },
  'RENOVACIÓN POPULAR':                                           { file: '00000035.jpg', primary: '#0060A0', secondary: '#60A0C0' },
  'SALVEMOS AL PERÚ':                                             { file: '00000036.jpg', primary: '#F00000', secondary: '#F09090' },
  'UN CAMINO DIFERENTE':                                          { file: '00000037.jpg', primary: '#F00000', secondary: '#F03030' },
  'UNIDAD NACIONAL':                                              { file: '00000038.jpg', primary: '#005000', secondary: '#F0C0C0' },
};

export function getPartyVisual(party: string): PartyVisual | null {
  return PARTY_VISUALS[party] ?? null;
}

export function getPartyPhotoUrl(party: string): string | null {
  const v = PARTY_VISUALS[party];
  return v ? `/partidos/${v.file}` : null;
}
