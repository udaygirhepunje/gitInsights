import { addDaysIso, toIsoDateKey } from './dates';
import { isHolidayDay, isOffDay, isPtoDay, isWorkday, type OffDayContext } from './offDay';
import type { StreakMode } from '../userData/schema';

// Spec §6 Streak Modes. PTO + Public Holiday always skip (they never extend
// or break a streak in any mode). Non-workday handling is mode-specific:
//   - strict:              non-workdays are fully evaluated (commit = extend, miss = break).
//   - skip-non-workdays:   non-workdays are OPTIONAL — commit extends, miss is a free skip.
//   - workdays-only:       non-workdays are completely ignored (commits on them don't count).

export type StreakArgs = {
  byDate: ReadonlyMap<string, number>;
  ctx: OffDayContext;
  mode: StreakMode;
  today?: string;
};

function isPtoOrHoliday(date: string, ctx: OffDayContext): boolean {
  return isPtoDay(date, ctx) || isHolidayDay(date, ctx);
}

// 'eval'  — required: commit extends streak, miss breaks it.
// 'bonus' — optional: commit extends streak, miss is a free pass.
// 'skip'  — ignored:  commit is discarded, miss is a free pass.
function dayVerdict(date: string, ctx: OffDayContext, mode: StreakMode): 'eval' | 'bonus' | 'skip' {
  if (isPtoOrHoliday(date, ctx)) return 'skip';
  if (mode === 'strict') return 'eval';
  if (!isWorkday(date, ctx.workdays)) {
    return mode === 'skip-non-workdays' ? 'bonus' : 'skip';
  }
  return 'eval';
}

export function currentStreakInfo(args: StreakArgs): { days: number; lastBrokenOn: string | null } {
  const today = args.today ?? toIsoDateKey(new Date());
  let streak = 0;
  let cursor = today;
  let lastBrokenOn: string | null = null;
  let safety = 366 * 5;
  while (safety-- > 0) {
    const verdict = dayVerdict(cursor, args.ctx, args.mode);
    if (verdict === 'skip') { cursor = addDaysIso(cursor, -1); continue; }
    const committed = (args.byDate.get(cursor) ?? 0) > 0;
    if (!committed && verdict === 'eval') { lastBrokenOn = cursor; break; }
    if (committed) streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return { days: streak, lastBrokenOn };
}

export function currentStreak(args: StreakArgs): number {
  return currentStreakInfo(args).days;
}

export function lastStreakInfo(args: StreakArgs): { days: number } {
  const cur = currentStreakInfo(args);
  if (!cur.lastBrokenOn) return { days: 0 };
  const prev: StreakArgs = { ...args, today: addDaysIso(cur.lastBrokenOn, -1) };
  return { days: currentStreakInfo(prev).days };
}

export function longestStreak(args: StreakArgs): number {
  return longestStreakInfo(args).days;
}

export function longestStreakInfo(args: StreakArgs): { days: number; brokenOn: string | null } {
  const today = args.today ?? toIsoDateKey(new Date());
  const dates = [...args.byDate.keys()].filter((d) => d <= today).sort();
  if (dates.length === 0) return { days: 0, brokenOn: null };
  let best = 0;
  let current = 0;
  let brokenOn: string | null = null;
  let cursor = dates[0]!;
  let safety = 366 * 25;
  while (cursor <= today && safety-- > 0) {
    const verdict = dayVerdict(cursor, args.ctx, args.mode);
    if (verdict !== 'skip') {
      const committed = (args.byDate.get(cursor) ?? 0) > 0;
      if (committed) {
        current += 1;
        if (current > best) {
          best = current;
          brokenOn = null; // new record, may still be running
        }
      } else if (verdict === 'eval') {
        if (current >= best && best > 0) brokenOn = cursor;
        current = 0;
      }
      // bonus + no commit: free pass, current unchanged
    }
    cursor = addDaysIso(cursor, 1);
  }
  return { days: best, brokenOn };
}

export type StreakDot = {
  date: string;
  /** committed on this day */
  hit: boolean;
  /** 'eval' = required (miss = red), 'bonus' = optional (miss = muted) */
  verdict: 'eval' | 'bonus';
};

/** Last `maxDots` relevant days (non-skipped), oldest→newest, for the dot bar. */
export function streakDots(args: StreakArgs & { maxDots?: number }): StreakDot[] {
  const today = args.today ?? toIsoDateKey(new Date());
  const max = args.maxDots ?? 21;
  const dots: StreakDot[] = [];
  let cursor = today;
  let safety = 366 * 2;
  while (dots.length < max && safety-- > 0) {
    const v = dayVerdict(cursor, args.ctx, args.mode);
    if (v !== 'skip') {
      dots.push({ date: cursor, hit: (args.byDate.get(cursor) ?? 0) > 0, verdict: v });
    }
    cursor = addDaysIso(cursor, -1);
  }
  return dots.reverse();
}

export function longestBreakDays(args: Omit<StreakArgs, 'mode'>): number {
  const today = args.today ?? toIsoDateKey(new Date());
  const dates = [...args.byDate.keys()].filter((d) => d <= today).sort();
  if (dates.length === 0) return 0;
  let best = 0;
  let current = 0;
  let cursor = dates[0]!;
  let safety = 366 * 25;
  while (cursor <= today && safety-- > 0) {
    if (isOffDay(cursor, args.ctx)) {
      cursor = addDaysIso(cursor, 1);
      continue;
    }
    const count = args.byDate.get(cursor) ?? 0;
    if (count > 0) {
      current = 0;
    } else {
      current += 1;
      if (current > best) best = current;
    }
    cursor = addDaysIso(cursor, 1);
  }
  return best;
}
