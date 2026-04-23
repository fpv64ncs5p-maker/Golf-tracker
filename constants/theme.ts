/**
 * Golf Tracker Design Tokens
 *
 * Shared colors, spacing, typography, and component styles.
 * Import from here instead of hardcoding values in StyleSheet.create().
 */

export const COLORS = {
  // Primary
  primary: '#4CAF50',
  primaryDark: '#388E3C',
  primaryLight: '#C8E6C9',

  // Neutrals
  background: '#fff',
  surface: '#f9f9f9',
  surfaceAlt: '#f5f5f5',
  surfaceMuted: '#f0f0f0',
  border: '#ddd',
  borderLight: '#eee',
  borderSubtle: '#f0f0f0',

  // Text
  textPrimary: '#333',
  textSecondary: '#666',
  textMuted: '#999',
  textOnPrimary: '#fff',
  textOnDark: '#fff',

  // Score colors
  eagle: '#1565C0',
  birdie: '#4CAF50',
  par: '#333',
  bogey: '#e53935',
  doublePlus: '#b71c1c',

  // Tee colors
  teeBlue: '#1565C0',
  teeWhite: '#f5f5f5',
  teeYellow: '#F9A825',
  teeRed: '#C62828',
  teeOrange: '#E65100',
  teeGreen: '#2E7D32',
  teeBlack: '#111',
  teeGold: '#F57F17',
  teePurple: '#6A1B9A',

  // Semantic
  error: '#e53935',
  errorDark: '#b71c1c',
  warning: '#FF9800',
  success: '#4CAF50',
  info: '#1565C0',

  // UI elements
  disabled: '#ccc',
  black: '#000',
  white: '#fff',
} as const;

export const TEE_COLOUR_MAP: Record<string, { color: string; text: string; border?: string }> = {
  Blue:   { color: COLORS.teeBlue,   text: COLORS.white },
  White:  { color: COLORS.teeWhite,  text: COLORS.textPrimary, border: COLORS.border },
  Yellow: { color: COLORS.teeYellow, text: COLORS.white },
  Red:    { color: COLORS.teeRed,    text: COLORS.white },
  Orange: { color: COLORS.teeOrange, text: COLORS.white },
  Green:  { color: COLORS.teeGreen,  text: COLORS.white },
  Black:  { color: COLORS.teeBlack,  text: COLORS.white },
  Gold:   { color: COLORS.teeGold,   text: COLORS.white },
  Purple: { color: COLORS.teePurple, text: COLORS.white },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 40,
} as const;

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  title: 26,
  hero: 32,
  score: 52,
} as const;

export const RADIUS = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
} as const;

/**
 * Returns the color for a score relative to par
 */
export function scoreColor(diff: number): string {
  if (diff <= -2) return COLORS.eagle;
  if (diff === -1) return COLORS.birdie;
  if (diff === 0) return COLORS.par;
  if (diff === 1) return COLORS.bogey;
  return COLORS.doublePlus;
}
