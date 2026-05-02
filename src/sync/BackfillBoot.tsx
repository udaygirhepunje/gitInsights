import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { prefetchMonthIfMissing } from '../api/commitsByDayRange';
import { trailingMonthKeysDescending } from '../api/githubCommitsSearch';
import { useAuth } from '../hooks/useAuth';
import { useGitHub } from '../hooks/useGitHub';

const BACKFILL_STEP_MS = 15_000;

function invalidateCommitsQueries(queryClient: ReturnType<typeof useQueryClient>, login: string) {
  void queryClient.invalidateQueries({
    predicate: (q) => {
      const key = q.queryKey;
      return (
        Array.isArray(key) && key[0] === 'viewer' && key[1] === 'commitsByDay' && key[2] === login
      );
    },
  });
}

/** Background month prefetch for trailing 12 months (spec §3.D.1). */
export function BackfillBoot(): null {
  const { status, viewer } = useAuth();
  const clients = useGitHub();
  const queryClient = useQueryClient();
  const genRef = useRef(0);

  useEffect(() => {
    if (status !== 'authenticated' || !viewer?.login || !clients) return;
    const login = viewer.login;
    const myGen = genRef.current + 1;
    genRef.current = myGen;
    let cancelled = false;

    const run = async () => {
      const months = trailingMonthKeysDescending(12);
      for (let i = 0; i < months.length; i += 1) {
        if (cancelled || genRef.current !== myGen) break;
        if (i > 0) await new Promise((r) => setTimeout(r, BACKFILL_STEP_MS));
        if (cancelled || genRef.current !== myGen) break;
        const month = months[i];
        if (month === undefined) break;
        await prefetchMonthIfMissing(clients, login, month, 'backfill');
        invalidateCommitsQueries(queryClient, login);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [clients, queryClient, status, viewer?.login]);

  return null;
}
