import {
    DarkTheme as NavigationDarkTheme,
    DefaultTheme as NavigationLightTheme,
    type Theme as NavigationTheme,
} from "@react-navigation/native";
import {
    adaptNavigationTheme,
    MD3DarkTheme,
    MD3LightTheme,
    type MD3Theme,
} from "react-native-paper";

import Colors from "@/constants/Colors";
import { uiRadius } from "@/constants/UiTokens";

const { LightTheme: AdaptedNavigationLight, DarkTheme: AdaptedNavigationDark } =
  adaptNavigationTheme({
    reactNavigationLight: NavigationLightTheme,
    reactNavigationDark: NavigationDarkTheme,
    materialLight: MD3LightTheme,
    materialDark: MD3DarkTheme,
  });

export type AppColorScheme = keyof typeof Colors;
export type AppPalette = (typeof Colors)["light"];

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
    roundness: uiRadius.lg,
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
      errorContainer: palette.dangerContainer,
      onErrorContainer: palette.onDangerContainer,
      background: palette.background,
      onBackground: palette.text,
      surface: palette.card,
      onSurface: palette.text,
      surfaceVariant: palette.cardAlt,
      onSurfaceVariant: palette.muted,
      outline: palette.border,
      outlineVariant: palette.borderSoft,
      inverseSurface: palette.inverseSurface,
      inverseOnSurface: palette.inverseOnSurface,
      inversePrimary: palette.inversePrimary,
      shadow: palette.shadow,
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
