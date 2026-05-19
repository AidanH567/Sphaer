import { Platform } from 'react-native';

export const colors = {
  white: '#FFFFFF',
  black: '#0D0D0D',

  background: '#FFFFFF',
  surface: '#F5F5F5',

  text: {
    primary: '#0D0D0D',
    secondary: '#666666',
    tertiary: '#999999',
    inverse: '#FFFFFF',
    placeholder: '#AAAAAA',
  },

  border: '#E5E5E5',
  borderDark: '#0D0D0D',

  input: {
    background: '#FFFFFF',
    border: '#E5E5E5',
    borderFocused: '#0D0D0D',
  },

  badge: {
    red: '#E53935',
    redText: '#FFFFFF',
  },

  tag: {
    background: '#FFFFFF',
    border: '#0D0D0D',
    backgroundSelected: '#0D0D0D',
    textSelected: '#FFFFFF',
  },

  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

// Font family names must match the keys used in useFonts() in app/_layout.tsx
export const fontFamilies = {
  // Editorial / display — Test Martina Plantijn
  // Used for: event titles, page headings, profile names, large feature text
  display: 'TestMartinaPlantijn-Regular',
  displayItalic: 'TestMartinaPlantijn-Italic',

  // UI / body — SF Pro (iOS system font), Roboto (Android), system-ui (web)
  // Used for: buttons, labels, metadata, inputs, chips, captions
  ui: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }) as string,
} as const;

export const typography = {
  fontFamily: {
    // Legacy aliases kept for backwards compat — prefer fontFamilies above in new code
    regular: fontFamilies.ui,
    medium: fontFamilies.ui,
    bold: fontFamilies.ui,
    // New semantic tokens
    display: fontFamilies.display,
    displayItalic: fontFamilies.displayItalic,
    ui: fontFamilies.ui,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 28,
    '3xl': 32,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

export const theme = { colors, typography, spacing, radius, shadow } as const;
export type Theme = typeof theme;
