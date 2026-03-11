import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Surface, useTheme, type MD3Theme } from "react-native-paper";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import {
    uiBorder,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";

type SectionSurfaceProps = {
  palette: AppPalette;
  label?: string;
  title?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
};

export function SectionSurface({
  palette,
  label,
  title,
  children,
  style,
  elevation = 1,
}: SectionSurfaceProps) {
  const theme = useTheme<MD3Theme>();
  const surfaceColor =
    elevation === 0
      ? theme.colors.surface
      : theme.colors.elevation[`level${elevation}`];

  return (
    <Surface
      style={[
        styles.card,
        {
          backgroundColor: surfaceColor,
          borderColor: theme.colors.outlineVariant,
        },
        style,
      ]}
      elevation={elevation}
    >
      {label ? (
        <Text style={[styles.label, { color: theme.colors.primary }]}>
          {label}
        </Text>
      ) : null}
      {title ? (
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    marginBottom: uiSpace.xxl,
  },
  label: {
    ...uiTypography.label,
    marginBottom: uiSpace.sm,
    textTransform: "uppercase",
  },
  title: {
    ...uiTypography.titleLg,
    marginBottom: uiSpace.md,
  },
});
