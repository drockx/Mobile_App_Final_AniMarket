/** Shared foundation for AniMarket's light mobile screens. */
export const appColors = {
  forest: '#12372a', green: '#2d6a4f', mint: '#eaf5ed',
  background: '#eef3ef', surface: '#f8fbf9', line: '#dfe8e2',
  text: '#17221d', muted: '#52645a', danger: '#b42318', white: '#fff',
} as const;

export const appTypography = {
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  section: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21 },
  input: { fontSize: 16, lineHeight: 22 },
  button: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
} as const;

/** Matching frames for editable inputs, dropdowns, and date selectors. */
export const appFormStyles = {
  field: { minWidth: 0, gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '700', includeFontPadding: false },
  control: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 12 },
  value: { ...appTypography.input, includeFontPadding: false, textAlign: 'left' },
} as const;
