const palette = {
  // Purple (primary)
  purple50:  '#F3F0FF',
  purple100: '#E9E3FF',
  purple500: '#8B6BFF',
  purple600: '#6C4CFF',
  purple700: '#5438CC',
  purple800: '#3D2799',

  // Teal (secondary)
  teal50:  '#E6FDF9',
  teal400: '#2DD4BF',
  teal500: '#11C5A5',
  teal600: '#0DA08A',

  // Amber (accent)
  amber50:  '#FFFBEB',
  amber400: '#FBBF24',
  amber500: '#FFB020',
  amber600: '#D97706',

  white:   '#FFFFFF',
  gray50:  '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray300: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray700: '#616161',
  gray800: '#424242',
  gray900: '#212121',
  black:   '#000000',

  red500:     '#EF4444',
  red50:      '#FEF2F2',
  emerald500: '#10B981',
  emerald50:  '#ECFDF5',
  blue500:    '#3B82F6',
  blue50:     '#EFF6FF',
} as const;

export interface AppColors {
  primary:        string;
  primaryDark:    string;
  primaryLight:   string;
  primarySurface: string;
  secondary:      string;
  secondaryDark:  string;
  accent:         string;
  accentSurface:  string;
  background:     string;
  surface:        string;
  card:           string;
  elevated:       string;
  text:           string;
  textSecondary:  string;
  textTertiary:   string;
  textOnPrimary:  string;
  border:         string;
  divider:        string;
  disabled:       string;
  placeholder:    string;
  skeleton:       string;
  error:          string;
  errorSurface:   string;
  success:        string;
  successSurface: string;
  info:           string;
  infoSurface:    string;
  warning:        string;
  overlay:        string;
  shadow:         string;
  scrim:          string;
  statusBar:      string;
  tabBar:         string;
  bottomSheet:    string;
  gradient: {
    primary: string[];
    secondary: string[];
    splash: string[];
  };
}

export const LightColors: AppColors = {
  primary:        palette.purple600,
  primaryDark:    palette.purple700,
  primaryLight:   palette.purple500,
  primarySurface: palette.purple50,

  secondary:     palette.teal500,
  secondaryDark: palette.teal600,

  accent:        palette.amber500,
  accentSurface: palette.amber50,

  background: '#F4F7FF',
  surface:    palette.white,
  card:       palette.white,
  elevated:   palette.white,

  text:          palette.gray900,
  textSecondary: palette.gray600,
  textTertiary:  palette.gray500,
  textOnPrimary: palette.white,

  border:      palette.gray300,
  divider:     palette.gray200,
  disabled:    palette.gray400,
  placeholder: palette.gray500,
  skeleton:    palette.gray200,

  error:          palette.red500,
  errorSurface:   palette.red50,
  success:        palette.emerald500,
  successSurface: palette.emerald50,
  info:           palette.blue500,
  infoSurface:    palette.blue50,
  warning:        palette.amber500,

  overlay: 'rgba(0,0,0,0.5)',
  shadow:  'rgba(108,76,255,0.12)',
  scrim:   'rgba(0,0,0,0.32)',

  statusBar:   palette.white,
  tabBar:      palette.white,
  bottomSheet: palette.white,

  gradient: {
    primary:   [palette.purple700, palette.purple600],
    secondary: [palette.teal600,   palette.teal500],
    splash:    [palette.purple800, '#4930B3', palette.purple700, '#6040E5', palette.purple600],
  },
};

export const DarkColors: AppColors = {
  primary:        palette.purple500,
  primaryDark:    palette.purple600,
  primaryLight:   palette.purple100,
  primarySurface: '#1A1040',

  secondary:     palette.teal400,
  secondaryDark: palette.teal500,

  accent:        palette.amber400,
  accentSurface: '#2A1A05',

  background: '#0B0F14',
  surface:    '#141B22',
  card:       '#1A2330',
  elevated:   '#1F2937',

  text:          '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary:  '#64748B',
  textOnPrimary: palette.white,

  border:      '#1E293B',
  divider:     '#1E293B',
  disabled:    '#475569',
  placeholder: '#64748B',
  skeleton:    '#1E293B',

  error:          '#F87171',
  errorSurface:   '#1C1012',
  success:        '#34D399',
  successSurface: '#0C1A14',
  info:           '#60A5FA',
  infoSurface:    '#0C1524',
  warning:        palette.amber400,

  overlay: 'rgba(0,0,0,0.7)',
  shadow:  'rgba(0,0,0,0.3)',
  scrim:   'rgba(0,0,0,0.6)',

  statusBar:   '#0B0F14',
  tabBar:      '#141B22',
  bottomSheet: '#1A2330',

  gradient: {
    primary:   ['#3D2799', palette.purple700],
    secondary: [palette.teal600, palette.teal500],
    splash:    ['#050810', '#101028', '#1A1040', '#3A2870', palette.purple700],
  },
};
