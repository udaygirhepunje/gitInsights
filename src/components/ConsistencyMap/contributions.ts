import type { ViewerContributions } from '../../api/queries';
import type { CommitsCoverage } from '../../api/commitsByDayRange';

// Flattens contribution payloads into a date-sorted list of
// `(date, count, weekday)` rows — the shape the heatmap, a11y table, and
// streak / consistency calculators all consume.

export type HeatmapRow = {
  date: string;
  count: number;
  weekday: number;
  /** True while that month's chunk is not yet merged (Phase 11 backfill). */
  pending?: boolean;
};

export type HeatmapDatum = HeatmapRow & {
  timestamp: number;
};

type ContributionCalendar = ViewerContributions['viewer']['contributionsCollection']['contributionCalendar'];

function weekdayFromIsoDate(date: string): number {
  return new Date(`${date}T00:00:00`).getDay();
}

export function flattenContributions(
  calendar: ContributionCalendar | undefined,
): HeatmapRow[] {
  if (!calendar) return [];
  const rows: HeatmapRow[] = [];
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) {
      rows.push({
        date: day.date,
        count: day.contributionCount,
        weekday: weekdayFromIsoDate(day.date),
      });
    }
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
}

export function toCalHeatmapData(rows: HeatmapRow[]): HeatmapDatum[] {
  return rows.map((row) => ({
    ...row,
    timestamp: Date.parse(`${row.date}T00:00:00`),
  }));
}

export type ContributionWindow = { from: Date; to: Date };

export function rollingYearWindow(now = new Date()): ContributionWindow {
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - 365);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function isDateMonthPending(isoDate: string, coverage?: CommitsCoverage): boolean {
  if (!coverage?.backfilling) return false;
  const month = isoDate.slice(0, 7);
  return !coverage.loadedMonthKeys.includes(month);
}

// Same `HeatmapRow[]` shape, but built from the per-day commit dict
// `useViewerCommitsByDay` returns. Iterates every date in the window so the
// heatmap renders zero-cells for days with no commits.
export function commitsToHeatmapRows(
  byDate: Record<string, number>,
  window: ContributionWindow,
  coverage?: CommitsCoverage,
): HeatmapRow[] {
  const rows: HeatmapRow[] = [];
  const cursor = new Date(window.from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(window.to);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    const date = `${y}-${m}-${day}`;
    rows.push({
      date,
      count: byDate[date] ?? 0,
      weekday: cursor.getDay(),
      pending: isDateMonthPending(date, coverage),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}

export function weekdayMax(rows: HeatmapRow[]): HeatmapRow | null {
  const first = rows[0];
  if (!first) return null;
  let max: HeatmapRow = first;
  for (const row of rows) if (row.count > max.count) max = row;
  return max;
}
