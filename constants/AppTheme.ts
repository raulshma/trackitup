import {
    DarkTheme as NavigationDarkTheme,
    DefaultTheme as NavigationLightTheme,
    type Theme as NavigationTheme,
} from "@react-navigation/native";
import {
    adaptNavigationTheme,
    configureFonts,
    MD3DarkTheme,
    MD3LightTheme,
    type MD3Theme,
} from "react-native-paper";

import Colors, {
    type AppColorScheme,
    type AppPalette,
} from "@/constants/Colors";
import { uiRadius } from "@/constants/UiTokens";

export type { AppColorScheme, AppPalette };

const { LightTheme: AdaptedNavigationLight, DarkTheme: AdaptedNavigationDark } =
  adaptNavigationTheme({
    reactNavigationLight: NavigationLightTheme,
    reactNavigationDark: NavigationDarkTheme,
    materialLight: MD3LightTheme,
    materialDark: MD3DarkTheme,
  });

const appFonts = configureFonts({
  config: {
    headlineSmall: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: "700",
      letterSpacing: 0,
    },
    titleLarge: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "600",
      letterSpacing: 0,
    },
    titleMedium: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "600",
      letterSpacing: 0.15,
    },
    titleSmall: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
      letterSpacing: 0.1,
    },
    labelLarge: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
      letterSpacing: 0.1,
    },
    labelMedium: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
      letterSpacing: 0.4,
    },
    labelSmall: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "600",
      letterSpacing: 0.4,
    },
    bodyLarge: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "400",
      letterSpacing: 0.15,
    },
    bodyMedium: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "400",
      letterSpacing: 0.1,
    },
    bodySmall: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "400",
      letterSpacing: 0.2,
    },
  },
});

export function getAppPalette(colorScheme: AppColorScheme): AppPalette {
  return Colors[colorScheme];
}

export function isDarkColorScheme(colorScheme: AppColorScheme): boolean {
  return colorScheme !== "light";
}

export function getAppThemes(colorScheme: AppColorScheme): {
  palette: AppPalette;
  paperTheme: MD3Theme;
  navigationTheme: NavigationTheme;
} {
  const palette = getAppPalette(colorScheme);
  const useDarkBaseTheme = isDarkColorScheme(colorScheme);
  const paperBaseTheme = useDarkBaseTheme ? MD3DarkTheme : MD3LightTheme;
  const navigationBaseTheme = useDarkBaseTheme
    ? AdaptedNavigationDark
    : AdaptedNavigationLight;

  const paperTheme: MD3Theme = {
    ...paperBaseTheme,
    roundness: uiRadius.md,
    fonts: appFonts,
    colors: {
      ...paperBaseTheme.colors,
      primary: palette.tint,
      onPrimary: palette.onTint,
      primaryContainer: palette.primaryContainer,
      onPrimaryContainer: palette.onPrimaryContainer,
      secondary: palette.secondary,
      onSecondary: palette.onSecondary,
      secondaryContainer: palette.secondaryContainer,
      onSecondaryContainer: palette.onSecondaryContainer,
      tertiary: palette.tertiary,
      onTertiary: palette.onTertiary,
      tertiaryContainer: palette.tertiaryContainer,
      onTertiaryContainer: palette.onTertiaryContainer,
      error: palette.danger,
      onError: paperBaseTheme.colors.onError,
      errorContainer: palette.dangerContainer,
      onErrorContainer: palette.onDangerContainer,
      background: palette.background,
      onBackground: palette.text,
      surface: palette.card,
      onSurface: palette.text,
      surfaceVariant: palette.cardAlt,
      surfaceDisabled: paperBaseTheme.colors.surfaceDisabled,
      onSurfaceVariant: palette.muted,
      onSurfaceDisabled: paperBaseTheme.colors.onSurfaceDisabled,
      outline: palette.border,
      outlineVariant: palette.borderSoft,
      inverseSurface: palette.inverseSurface,
      inverseOnSurface: palette.inverseOnSurface,
      inversePrimary: palette.inversePrimary,
      shadow: palette.shadow,
      scrim: paperBaseTheme.colors.scrim,
      backdrop: paperBaseTheme.colors.backdrop,
      elevation: {
        ...paperBaseTheme.colors.elevation,
        level0: palette.background,
        level1: palette.surface1,
        level2: palette.surface2,
        level3: palette.surface3,
        level4: palette.surface4,
        level5: palette.surface5,
      },
    },
  };

  const navigationTheme: NavigationTheme = {
    ...navigationBaseTheme,
    colors: {
      ...navigationBaseTheme.colors,
      primary: paperTheme.colors.primary,
      background: paperTheme.colors.background,
      card: paperTheme.colors.surface,
      text: paperTheme.colors.onSurface,
      border: paperTheme.colors.outlineVariant,
      notification: paperTheme.colors.primary,
    },
  };

  return {
    palette,
    paperTheme,
    navigationTheme,
  };
}
