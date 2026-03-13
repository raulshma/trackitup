import {
    Platform,
    StyleSheet,
    type TextStyle,
    type ViewStyle,
} from "react-native";

import { withAlpha } from "@/constants/Colors";

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
  topAppBarHeight: 64,
  scannerPreview: 320,
  calendarDayMin: 72,
  statusDot: 8,
  tabBarHeight: 80,
  tabBarActiveIndicatorWidth: 64,
} as const;

export const uiElevation = {
  card: 1,
  hero: 2,
  raisedCard: 3,
  chrome: 4,
} as const;

export const uiMotion = {
  quick: 140,
  standard: 220,
  slow: 320,
  stagger: 60,
  enterOffset: 14,
  pressScale: 0.985,
  hoverScale: 1.01,
  hoverLift: 4,
} as const;

export const uiTypography = {
  chip: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.2 },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  support: { fontSize: 12, lineHeight: 16 },
  bodySmall: { fontSize: 12, lineHeight: 16 },
  body: { fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  bodyStrong: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  titleSm: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  titleMd: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: 0.15,
  },
  titleSection: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  titleLg: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  titleXl: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  subtitle: { fontSize: 15, lineHeight: 22, letterSpacing: 0.1 },
  navTitle: { fontSize: 22, lineHeight: 28, fontWeight: "600" },
  heroEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  valueLg: { fontSize: 28, lineHeight: 32, fontWeight: "800" },
  tabLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  microLabel: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
} satisfies Record<string, TextStyle>;

type ShadowPreset = {
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
};

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
} satisfies Record<string, ShadowPreset>;

export function getShadowStyle(
  shadowColor: string,
  preset: ShadowPreset,
): ViewStyle {
  const { shadowOpacity = 0, shadowRadius = 0, shadowOffset } = preset;
  const offsetX = shadowOffset?.width ?? 0;
  const offsetY = shadowOffset?.height ?? 0;

  if (Platform.OS === "web") {
    const softenedRadius = Math.min(shadowRadius, 6);
    const softenedOpacity = Math.min(shadowOpacity, 0.08);
    const softenedOffsetY =
      offsetY === 0 ? 0 : Math.sign(offsetY) * Math.min(Math.abs(offsetY), 2);

    return {
      boxShadow: `${offsetX}px ${softenedOffsetY}px ${softenedRadius}px ${withAlpha(
        shadowColor,
        softenedOpacity,
      )}`,
    } as ViewStyle;
  }

  return {
    shadowColor,
    shadowOpacity,
    shadowRadius,
    shadowOffset: { width: offsetX, height: offsetY },
  };
}
