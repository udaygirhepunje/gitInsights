import { formatDisplayDayMonth, startOfDay, sundayWeekKey, sundayWeekRange, toIsoDateKey } from './dates';
import { isOffDay, type OffDayContext } from './offDay';

export type AverageCommitsSummary = {
  totalCommits: number;
  effectiveWorkingDays: number;
  average: number | null;
  isRestWindow: boolean;
};

type WeeklyAverageSlice = {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  commits: number;
  effectiveWorkingDays: number;
  workingDates: string[];
};

export type AverageCommitsTrendPoint = {
  label: string;
  from: string;
  to: string;
  commits: number;
  effectiveWorkingDays: number;
  average: number;
  isRest: boolean;
  highlightDates: readonly string[];
};

export type AverageCommitsTrendGranularity = 'weekly' | 'daily';

export function countEffectiveWorkingDays(args: {
  from: Date;
  to: Date;
  ctx: OffDayContext;
}): number {
  let count = 0;
  const cursor = startOfDay(args.from);
  const end = startOfDay(args.to);
  while (cursor <= end) {
    const day = toIsoDateKey(cursor);
    if (!isOffDay(day, args.ctx)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function summarizeAverageCommitsPerDay(args: {
  totalCommits: number;
  effectiveWorkingDays: number;
}): AverageCommitsSummary {
  if (args.effectiveWorkingDays === 0) {
    return {
      totalCommits: args.totalCommits,
      effectiveWorkingDays: 0,
      average: null,
      isRestWindow: true,
    };
  }
  return {
    totalCommits: args.totalCommits,
    effectiveWorkingDays: args.effectiveWorkingDays,
    average: args.totalCommits / args.effectiveWorkingDays,
    isRestWindow: false,
  };
}

function weeklySlices(args: {
  byDate: ReadonlyMap<string, number>;
  ctx: OffDayContext;
  from: Date;
  to: Date;
}): WeeklyAverageSlice[] {
  const buckets = new Map<string, WeeklyAverageSlice>();
  const cursor = startOfDay(args.from);
  const end = startOfDay(args.to);
  while (cursor <= end) {
    const day = toIsoDateKey(cursor);
    const weekKey = sundayWeekKey(cursor);
    if (!buckets.has(weekKey)) {
      const range = sundayWeekRange(cursor);
      const windowStart = startOfDay(args.from);
      const windowEnd = startOfDay(args.to);
      const clippedStart = range.from > windowStart ? range.from : windowStart;
      const clippedEnd = range.to < windowEnd ? range.to : windowEnd;
      buckets.set(weekKey, {
        weekKey,
        weekStart: toIsoDateKey(clippedStart),
        weekEnd: toIsoDateKey(clippedEnd),
        commits: 0,
        effectiveWorkingDays: 0,
        workingDates: [],
      });
    }
    const bucket = buckets.get(weekKey)!;
    bucket.commits += args.byDate.get(day) ?? 0;
    if (!isOffDay(day, args.ctx)) {
      bucket.effectiveWorkingDays += 1;
      bucket.workingDates.push(day);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return [...buckets.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

function slicesToPoint(slices: WeeklyAverageSlice[], label: string): AverageCommitsTrendPoint {
  const commits = slices.reduce((sum, slice) => sum + slice.commits, 0);
  const effectiveWorkingDays = slices.reduce((sum, slice) => sum + slice.effectiveWorkingDays, 0);
  return {
    label,
    from: slices[0]!.weekStart,
    to: slices[slices.length - 1]!.weekEnd,
    commits,
    effectiveWorkingDays,
    average: effectiveWorkingDays === 0 ? 0 : commits / effectiveWorkingDays,
    isRest: effectiveWorkingDays === 0,
    highlightDates: slices.flatMap((slice) => slice.workingDates),
  };
}

function perWeekPoints(slices: WeeklyAverageSlice[]): AverageCommitsTrendPoint[] {
  return slices.map((slice) => {
    const weekNo = slice.weekKey.split('-W')[1] ?? '??';
    return slicesToPoint([slice], `w${weekNo}`);
  });
}

function perWorkingDayPoints(args: {
  byDate: ReadonlyMap<string, number>;
  ctx: OffDayContext;
  from: Date;
  to: Date;
}): AverageCommitsTrendPoint[] {
  const points: AverageCommitsTrendPoint[] = [];
  const cursor = startOfDay(args.from);
  const end = startOfDay(args.to);
  while (cursor <= end) {
    const day = toIsoDateKey(cursor);
    if (!isOffDay(day, args.ctx)) {
      const commits = args.byDate.get(day) ?? 0;
      points.push({
        label: formatDisplayDayMonth(day),
        from: day,
        to: day,
        commits,
        effectiveWorkingDays: 1,
        average: commits,
        isRest: false,
        highlightDates: [day],
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

export function buildAverageCommitsTrend(args: {
  byDate: ReadonlyMap<string, number>;
  ctx: OffDayContext;
  from: Date;
  to: Date;
  granularity?: AverageCommitsTrendGranularity;
}): AverageCommitsTrendPoint[] {
  if (args.granularity === 'daily') return perWorkingDayPoints(args);

  const slices = weeklySlices(args);
  if (slices.length === 0) return [];
  return perWeekPoints(slices);
}
