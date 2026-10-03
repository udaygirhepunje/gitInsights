import { useMemo } from 'react';

import type { CellAdornment } from '../components/ConsistencyMap/ConsistencyMap';
import { useHolidays } from '../userData/useHolidays';
import { usePto } from '../userData';
import { useOffDayContext } from '../userData/useOffDayContext';
import { dayOfWeek } from '../analytics/dates';

// Returns the `cellAdornments(date)` lookup the heatmap consumes.
// PTO + Public Holiday days share the off-day color (spec §6); holidays also
// set `publicHoliday` so the grid paints a bottom-left wedge. Tooltip / a11y
// label disambiguate by source. Commit-on-off-day overlays the violation dot
// via the heatmap's `data-gi-violation` attribute.

const PTO_COLOR = 'var(--mantine-color-primerYellow-4)';
const NON_WORKDAY_COLOR = 'var(--gi-heatmap-non-workday)';

function ptoLabel(kind: string | undefined, label: string | undefined): string {
  const kindLabel = kind ? kind[0]!.toUpperCase() + kind.slice(1) : 'PTO';
  return label ? `PTO: ${label}` : `PTO: ${kindLabel}`;
}

function ptoTooltipDetail(entry: { label?: string; kind?: string }): string {
  if (entry.label) return entry.label;
  if (entry.kind) return entry.kind[0]!.toUpperCase() + entry.kind.slice(1);
  return '';
}

export function useCellAdornments(byDate: ReadonlyMap<string, number>): (date: string) => CellAdornment | undefined {
  const pto = usePto();
  const holidays = useHolidays();
  const { ctx } = useOffDayContext();

  const ptoMap = useMemo(() => {
    const m = new Map<string, { label?: string; kind?: string }>();
    for (const entry of pto) m.set(entry.date, { label: entry.label, kind: entry.kind });
    return m;
  }, [pto]);

  return useMemo(() => {
    return (date: string): CellAdornment | undefined => {
      const ptoEntry = ptoMap.get(date);
      const holidayEntries = holidays.lookup.get(date);
      const overridden = ctx.overrideSet.has(date);
      const hasCount = (byDate.get(date) ?? 0) > 0;
      const isWorkday = ctx.workdays.has(dayOfWeek(date));

      if (ptoEntry) {
        return {
          color: PTO_COLOR,
          overlayDot: hasCount,
          label: ptoLabel(ptoEntry.kind, ptoEntry.label),
          tooltipDetail: ptoTooltipDetail(ptoEntry),
        };
      }

      if (holidayEntries && holidayEntries.length > 0 && !overridden) {
        const names = holidayEntries.map((h) => h.name).join(' · ');
        return {
          color: PTO_COLOR,
          overlayDot: hasCount,
          label: `Public Holiday: ${names}`,
          publicHoliday: true,
          tooltipDetail: names,
        };
      }

      if (!isWorkday) {
        return {
          color: NON_WORKDAY_COLOR,
          overlayDot: hasCount, // Mark commits on non-working days as a violation dot? The prompt says it drives every weekend/non-workday metric, so showing a dot is probably desired just like PTO.
          label: 'Non-working day',
          nonWorkday: true,
        };
      }

      return undefined;
    };
  }, [byDate, ctx.workdays, ctx.overrideSet, holidays.lookup, ptoMap]);
}
