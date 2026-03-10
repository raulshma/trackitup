import { StyleSheet, type TextStyle, type ViewStyle } from "react-native";

export const uiSpace = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  surface: 18,
  screen: 20,
  hero: 22,
  screenBottom: 32,
  screenBottomTabs: 120,
} as const;

export const uiRadius = {
  sm: 14,
  md: 16,
  lg: 20,
  panel: 22,
  xl: 24,
  hero: 28,
  pill: 999,
} as const;

export const uiBorder = {
  standard: 1,
  hairline: StyleSheet.hairlineWidth,
} as const;

export const uiSize = {
  headerAction: 40,
  scannerPreview: 320,
  calendarDayMin: 72,
  statusDot: 8,
  tabBarHeight: 72,
} as const;

export const uiElevation = {
  card: 1,
  hero: 2,
  raisedCard: 3,
  chrome: 8,
} as const;

export const uiTypography = {
  chip: { fontSize: 12, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  support: { fontSize: 12, lineHeight: 18 },
  bodySmall: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontSize: 14, fontWeight: "700" },
  titleSm: { fontSize: 15, fontWeight: "700" },
  titleMd: { fontSize: 16, fontWeight: "700" },
  titleSection: { fontSize: 17, fontWeight: "700" },
  titleLg: { fontSize: 18, fontWeight: "700" },
  titleXl: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 15, lineHeight: 22 },
  navTitle: { fontSize: 22, fontWeight: "600" },
  heroEyebrow: { fontSize: 13, fontWeight: "700" },
  heroTitle: { fontSize: 30, lineHeight: 38, fontWeight: "700" },
  valueLg: { fontSize: 26, fontWeight: "800" },
  tabLabel: { fontSize: 11, fontWeight: "600" },
  microLabel: { fontSize: 11, fontWeight: "800" },
} satisfies Record<string, TextStyle>;

export const uiShadow = {
  headerAction: {
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  tabBar: {
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
  },
  raisedCard: {
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
} satisfies Record<string, ViewStyle>;
