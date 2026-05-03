import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

function formatAgo(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/** Latest successful query `dataUpdatedAt` across the cache — drives "cache · … ago" in the shell. */
/** How often the "cache · … ago" label recomputes (does not affect query freshness). */
const FRESHNESS_UI_TICK_MS = 10_000;

export function useQueryCacheFreshness(enabled: boolean): string | null {
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, FRESHNESS_UI_TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    return queryClient.getQueryCache().subscribe(() => {
      setTick((t) => t + 1);
    });
  }, [enabled, queryClient]);

  return useMemo(() => {
    void tick;
    if (!enabled) return null;
    let max = 0;
    for (const q of queryClient.getQueryCache().getAll()) {
      if (q.state.status !== 'success') continue;
      const t = q.state.dataUpdatedAt;
      if (typeof t === 'number' && t > max) max = t;
    }
    if (max === 0) return null;
    return formatAgo(Date.now() - max);
  }, [enabled, queryClient, tick]);
}
