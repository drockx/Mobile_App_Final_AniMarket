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
