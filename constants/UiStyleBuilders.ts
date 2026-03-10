import { StyleSheet } from "react-native";

import type { AppPalette } from "@/constants/AppTheme";

export function createCommonPaletteStyles(palette: AppPalette) {
  return StyleSheet.create({
    screenBackground: {
      backgroundColor: palette.background,
    },
    heroSurface: {
      backgroundColor: palette.hero,
      borderColor: palette.heroBorder,
    },
    cardSurface: {
      backgroundColor: palette.card,
      borderColor: palette.border,
    },
    raisedCardSurface: {
      backgroundColor: palette.card,
      borderColor: palette.border,
      shadowColor: palette.shadow,
    },
    cardChipSurface: {
      backgroundColor: palette.card,
    },
    accentChipSurface: {
      backgroundColor: palette.accentSoft,
    },
    primaryChipSurface: {
      backgroundColor: palette.primaryContainer,
    },
    mutedText: {
      color: palette.muted,
    },
    tintText: {
      color: palette.tint,
    },
    onPrimaryChipText: {
      color: palette.onPrimaryContainer,
    },
  });
}
