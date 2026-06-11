import { Box } from '@mantine/core';
import type { ReactNode } from 'react';
import styled from 'styled-components';

// Spec §4.C dashboard bento. 12-col CSS Grid:
//   row 1 — EP · Streak · WeeklyCodingDays
//   row 2 — Consistency (full width)
//   row 3 — MergedPrsAuthored · AverageCommitsPerDay
//   row 4 — WLB · TechStack
// Stacks to a single column on mobile.

export const BENTO_AREAS = {
  EP: 'EP',
  Streak: 'Streak',
  WeeklyCodingDays: 'WeeklyCodingDays',
  Consistency: 'Consistency',
  MergedPrsAuthored: 'MergedPrsAuthored',
  AverageCommitsPerDay: 'AverageCommitsPerDay',
  WLB: 'WLB',
  TechStack: 'TechStack',
} as const;

const Grid = styled(Box)`
  display: grid;
  width: 100%;
  gap: ${({ theme }) => theme.spacing.md};
  grid-auto-rows: minmax(220px, auto);

  grid-template-columns: 1fr;
  grid-template-areas:
    'EP'
    'Streak'
    'WeeklyCodingDays'
    'Consistency'
    'MergedPrsAuthored'
    'AverageCommitsPerDay'
    'WLB'
    'TechStack';

  @media (min-width: 640px) {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-areas:
      'EP EP EP EP EP EP Streak Streak Streak Streak Streak Streak'
      'WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays'
      'Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency'
      'MergedPrsAuthored MergedPrsAuthored MergedPrsAuthored MergedPrsAuthored MergedPrsAuthored MergedPrsAuthored AverageCommitsPerDay AverageCommitsPerDay AverageCommitsPerDay AverageCommitsPerDay AverageCommitsPerDay AverageCommitsPerDay'
      'WLB WLB WLB WLB WLB WLB WLB WLB WLB WLB WLB WLB'
      'TechStack TechStack TechStack TechStack TechStack TechStack TechStack TechStack TechStack TechStack TechStack TechStack';
  }

  @media (min-width: 992px) {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-areas:
      'EP EP EP EP Streak Streak Streak Streak WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays WeeklyCodingDays'
      'Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency Consistency'
      'MergedPrsAuthored MergedPrsAuthored MergedPrsAuthored MergedPrsAuthored MergedPrsAuthored MergedPrsAuthored AverageCommitsPerDay AverageCommitsPerDay AverageCommitsPerDay AverageCommitsPerDay AverageCommitsPerDay AverageCommitsPerDay'
      'WLB WLB WLB WLB WLB WLB WLB TechStack TechStack TechStack TechStack TechStack';
  }
` as typeof Box;

export function BentoGrid({ children }: { children: ReactNode }): JSX.Element {
  return <Grid role="list">{children}</Grid>;
}
