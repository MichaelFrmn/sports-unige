// Central design tokens. UNIGE brand magenta as the accent.
export const theme = {
  colors: {
    primary: '#CF0063',
    primaryDark: '#A5004F',
    bg: '#F5F6F8',
    surface: '#FFFFFF',
    text: '#1A1C1E',
    textMuted: '#5C6066',
    border: '#E3E6EA',
    success: '#1B8A5A',
    successBg: '#E6F4EC',
    danger: '#C62828',
    dangerBg: '#FBE9E9',
    warnBg: '#FFF4E0',
    warnText: '#9A6700',
  },
  radius: { sm: 8, md: 12, lg: 16 },
  spacing: (n: number) => n * 4,
};

export type Theme = typeof theme;
