import {
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
  type MantineThemeOverride,
  Popover,
  Tooltip,
} from '@mantine/core';

import {
  primerDark,
  primerFontFamily,
  primerLight,
  primerMonoFamily,
  primerRadius,
  primerShadows,
  primerShadowsDark,
  primerSpacing,
  primerSurfaces,
} from './primer-tokens';

// Mantine 7 takes one 10-shade tuple per color. We register Primer's *dark*
// scales as the canonical Mantine palette (gitInsights is GitHub-native and the
// dark scheme is the primary look). The light scheme is applied at runtime via
// `cssVariablesResolver` below, which swaps Mantine's own CSS variables to the
// `primerLight` scales whenever Mantine flips `colorScheme` to 'light'.

const colors = {
  primerGray: primerDark.gray as unknown as MantineColorsTuple,
  primerBlue: primerDark.blue as unknown as MantineColorsTuple,
  primerGreen: primerDark.green as unknown as MantineColorsTuple,
  primerYellow: primerDark.yellow as unknown as MantineColorsTuple,
  primerOrange: primerDark.orange as unknown as MantineColorsTuple,
  primerRed: primerDark.red as unknown as MantineColorsTuple,
  primerPurple: primerDark.purple as unknown as MantineColorsTuple,
  primerPink: primerDark.pink as unknown as MantineColorsTuple,
};

// `theme.other` is Mantine's escape hatch for app-specific tokens. Putting the
// per-scheme functional surfaces and the raw Primer scales here lets
// `styled(MantineComponent)` definitions read them via
// `({ theme }) => theme.other.primer.dark.bgDefault` without ever reaching for
// a hex literal.
const other = {
  primer: {
    dark: {
      ...primerDark,
      surfaces: primerSurfaces.dark,
    },
    light: {
      ...primerLight,
      surfaces: primerSurfaces.light,
    },
  },
  fontFamilyMono: primerMonoFamily,
  avatarFallbackGradient: 'linear-gradient(135deg, #4d2a87, #ee5a24)',
} as const;

// Drives Mantine's automatic var generation (`--mantine-spacing-md`, etc.).
const spacing = primerSpacing;
const radius = primerRadius;
const shadows = primerShadows;

export const mantineTheme: MantineThemeOverride = createTheme({
  fontFamily: primerFontFamily,
  fontFamilyMonospace: primerMonoFamily,
  primaryColor: 'primerBlue',
  // Dark filled buttons: shade 4 (#388bfd) fails 4.5:1 with white label text
  // (Lighthouse / WCAG). Shade 6 keeps the same hue family and passes.
  primaryShade: { light: 5, dark: 6 },
  defaultRadius: 'sm',
  cursorType: 'pointer',
  focusRing: 'auto',
  colors,
  spacing,
  radius,
  shadows,
  other,
  // Tooltip colors are flipped to match the active color scheme (dark
  // tooltip in dark mode, light tooltip in light mode) via `--tooltip-bg`
  // / `--tooltip-color` in `cssVariablesResolver` below. With a same-scheme
  // tooltip on a same-scheme page (notably white-on-white in light mode),
  // we add a 1px border + soft shadow here so the floating panel still
  // reads as a distinct surface.
  components: {
    Tooltip: Tooltip.extend({
      styles: {
        tooltip: {
          border: '1px solid var(--gi-border-default)',
          boxShadow: 'var(--mantine-shadow-lg)',
        },
      },
    }),
    Popover: Popover.extend({
      styles: {
        dropdown: {
          background: 'var(--gi-bg-overlay)',
          border: '1px solid var(--gi-border-default)',
        },
      },
    }),
  },
});

// Map Primer's functional surface tokens onto the Mantine CSS variables that
// every component (Card, Paper, Button outlines, dividers, …) reads. Mantine
// flips this resolver automatically when `colorScheme` changes, so a single
// theme object covers both modes.
export const cssVariablesResolver: CSSVariablesResolver = () => {
  const dark = primerSurfaces.dark;
  const light = primerSurfaces.light;

  return {
    variables: {
      // Shared tokens — same in both schemes.
      '--mantine-font-family': primerFontFamily,
      '--mantine-font-family-monospace': primerMonoFamily,
      '--gi-mono': primerMonoFamily,
    },
    light: {
      '--mantine-color-body': light.bgDefault,
      '--mantine-color-text': light.fgDefault,
      '--mantine-color-dimmed': light.fgMuted,
      '--mantine-color-default': light.bgDefault,
      '--mantine-color-default-hover': light.bgMuted,
      '--mantine-color-default-color': light.fgDefault,
      '--mantine-color-default-border': light.borderDefault,
      '--mantine-color-bright': light.fgDefault,
      '--mantine-color-placeholder': light.fgSubtle,
      '--mantine-color-anchor': light.accentFg,
      '--mantine-color-error': light.dangerFg,
      '--tooltip-bg': light.bgOverlay,
      '--tooltip-color': light.fgDefault,
      '--gi-bg-default': light.bgDefault,
      '--gi-bg-muted': light.bgMuted,
      '--gi-bg-subtle': light.bgSubtle,
      '--gi-bento-tile-bg': light.bgMuted,
      '--gi-bg-overlay': light.bgOverlay,
      '--gi-fg-default': light.fgDefault,
      '--gi-fg-muted': light.fgMuted,
      '--gi-fg-subtle': light.fgSubtle,
      '--gi-fg-on-emphasis': light.fgOnEmphasis,
      '--gi-border-default': light.borderDefault,
      '--gi-border-muted': light.borderMuted,
      '--gi-accent-fg': light.accentFg,
      '--gi-accent-emphasis': light.accentEmphasis,
      '--gi-success-fg': light.successFg,
      '--gi-success-emphasis': light.successEmphasis,
      '--gi-attention-fg': light.attentionFg,
      '--gi-danger-fg': light.dangerFg,
      '--gi-danger-emphasis': light.dangerEmphasis,
      '--gi-focus-outline': light.focusOutline,
      '--gi-heatmap-0': light.bgSubtle,
      '--gi-heatmap-1': primerLight.green[1],
      '--gi-heatmap-2': primerLight.green[2],
      '--gi-heatmap-3': primerLight.green[4],
      '--gi-heatmap-4': primerLight.green[5],
      '--gi-heatmap-highlight-ring': primerLight.gray[7],
      '--gi-heatmap-non-workday': primerLight.yellow[2],
    },
    dark: {
      '--mantine-color-body': dark.bgDefault,
      '--mantine-color-text': dark.fgDefault,
      '--mantine-color-dimmed': dark.fgMuted,
      '--mantine-color-default': dark.bgMuted,
      '--mantine-color-default-hover': dark.bgSubtle,
      '--mantine-color-default-color': dark.fgDefault,
      '--mantine-color-default-border': dark.borderDefault,
      '--mantine-color-bright': dark.fgDefault,
      '--mantine-color-placeholder': dark.fgSubtle,
      '--mantine-color-anchor': dark.accentFg,
      '--mantine-color-error': dark.dangerFg,
      '--tooltip-bg': dark.bgOverlay,
      '--tooltip-color': dark.fgDefault,
      '--mantine-shadow-xs': primerShadowsDark.xs,
      '--mantine-shadow-sm': primerShadowsDark.sm,
      '--mantine-shadow-md': primerShadowsDark.md,
      '--mantine-shadow-lg': primerShadowsDark.lg,
      '--mantine-shadow-xl': primerShadowsDark.xl,
      '--gi-bg-default': dark.bgDefault,
      '--gi-bg-muted': dark.bgMuted,
      '--gi-bg-subtle': dark.bgSubtle,
      '--gi-bento-tile-bg': dark.bgSubtle,
      '--gi-bg-overlay': dark.bgOverlay,
      '--gi-fg-default': dark.fgDefault,
      '--gi-fg-muted': dark.fgMuted,
      '--gi-fg-subtle': dark.fgSubtle,
      '--gi-fg-on-emphasis': dark.fgOnEmphasis,
      '--gi-border-default': dark.borderDefault,
      '--gi-border-muted': dark.borderMuted,
      '--gi-accent-fg': dark.accentFg,
      '--gi-accent-emphasis': dark.accentEmphasis,
      '--gi-success-fg': dark.successFg,
      '--gi-success-emphasis': dark.successEmphasis,
      '--gi-attention-fg': dark.attentionFg,
      '--gi-danger-fg': dark.dangerFg,
      '--gi-danger-emphasis': dark.dangerEmphasis,
      '--gi-focus-outline': dark.focusOutline,
      '--gi-heatmap-0': dark.bgMuted,
      '--gi-heatmap-1': primerDark.green[8],
      '--gi-heatmap-2': primerDark.green[6],
      '--gi-heatmap-3': primerDark.green[4],
      '--gi-heatmap-4': primerDark.green[2],
      '--gi-heatmap-highlight-ring': primerLight.gray[4],
      '--gi-heatmap-non-workday': primerDark.yellow[7],
    },
  };
};

export type AppMantineTheme = typeof mantineTheme;
