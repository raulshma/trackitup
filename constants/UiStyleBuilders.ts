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
      backgroundColor: palette.surface1,
      borderColor: palette.border,
    },
    raisedCardSurface: {
      backgroundColor: palette.surface2,
      borderColor: palette.borderSoft,
    },
    cardChipSurface: {
      backgroundColor: palette.surface2,
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
