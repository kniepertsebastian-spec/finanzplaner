// Validated 8-slot categorical palette (fixed order, never cycled — see the dataviz skill), shared
// between chart components that assign a color per category by index (e.g. donut + Sankey) so the
// same category renders in the same color across both.
export const CATEGORY_PALETTE: { light: string; dark: string }[] = [
  { light: '#2a78d6', dark: '#3987e5' },
  { light: '#eb6834', dark: '#d95926' },
  { light: '#1baf7a', dark: '#199e70' },
  { light: '#eda100', dark: '#c98500' },
  { light: '#e87ba4', dark: '#d55181' },
  { light: '#008300', dark: '#008300' },
  { light: '#4a3aa7', dark: '#9085e9' },
  { light: '#e34948', dark: '#e66767' },
];

export const OTHER_COLOR = { light: '#a3a3a3', dark: '#737373' };
