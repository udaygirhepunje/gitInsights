import type { CSSProperties } from 'react';

/** Tabular monospace for stat numbers (tiles, footers, tables). */
export const metricMonoStyle: CSSProperties = {
  fontFamily: 'var(--gi-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
  fontFeatureSettings: "'tnum'",
};
