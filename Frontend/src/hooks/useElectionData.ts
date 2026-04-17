import { useState, useEffect, useCallback, useRef } from 'react';
import {
  API_BASE,
  type Snapshot,
  type Timeline,
  type StatusMeta,
  type RegionSnapshot,
} from '../types/election';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const STATUS_POLL_MS = 15_000; // check /status every 15s

export function useElectionData() {
  const [current, setCurrent] = useState<Snapshot | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [status, setStatus] = useState<StatusMeta | null>(null);
  const [regions, setRegions] = useState<Record<string, RegionSnapshot>>({});
  const [abroad, setAbroad] = useState<RegionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastFetchRef = useRef<string | null>(null);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [snap, tl, hist, st, regData, abroadData] = await Promise.all([
        fetchJson<Snapshot>('/elections/presidential'),
        fetchJson<Timeline>('/elections/presidential/timeline').catch(() => null),
        fetchJson<{ snapshots: Snapshot[] }>('/elections/presidential/history'),
        fetchJson<StatusMeta>('/status'),
        fetchJson<{ regions: Record<string, RegionSnapshot> }>('/geographic/regions'),
        fetchJson<RegionSnapshot>('/geographic/abroad').catch(() => null),
      ]);
      setCurrent(snap);
      setTimeline(tl);
      setHistory(hist.snapshots);
      setStatus(st);
      setRegions(regData.regions);
      setAbroad(abroadData);
      lastFetchRef.current = st.last_full_fetch;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const st = await fetchJson<StatusMeta>('/status');
        setStatus(st);
        if (st.last_full_fetch && st.last_full_fetch !== lastFetchRef.current) {
          lastFetchRef.current = st.last_full_fetch;
          const [snap, tl, hist, regData, abroadData] = await Promise.all([
            fetchJson<Snapshot>('/elections/presidential'),
            fetchJson<Timeline>('/elections/presidential/timeline').catch(() => null),
            fetchJson<{ snapshots: Snapshot[] }>('/elections/presidential/history'),
            fetchJson<{ regions: Record<string, RegionSnapshot> }>('/geographic/regions'),
            fetchJson<RegionSnapshot>('/geographic/abroad').catch(() => null),
          ]);
          setCurrent(snap);
          setTimeline(tl);
          setHistory(hist.snapshots);
          setRegions(regData.regions);
          setAbroad(abroadData);
        }
      } catch {
      }
    }, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  return { current, timeline, history, status, regions, abroad, loading, error, refresh: refreshAll };
}
