import type { BentoTileState } from '../BentoTile';

export function resolveAverageCommitsPerDayTileState(args: {
  hasData: boolean;
  isLoading: boolean;
  isError: boolean;
  totalCommits: number;
  effectiveWorkingDays: number;
}): BentoTileState {
  if (!args.hasData) {
    if (args.isError) return 'error';
    if (args.isLoading) return 'loading';
    return 'loading';
  }

  // Denominator=0 is a deliberate "rest window" state, not empty.
  if (args.effectiveWorkingDays === 0) return 'loaded';
  if (args.totalCommits === 0) return 'empty';
  return 'loaded';
}
