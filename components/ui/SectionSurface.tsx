import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Surface, useTheme, type MD3Theme } from "react-native-paper";

import { Text } from "@/components/Themed";
import { withAlpha } from "@/constants/Colors";
import type { AppPalette } from "@/constants/AppTheme";
import {
    getShadowStyle,
    uiBorder,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { MotionView } from "./Motion";

type SectionSurfaceProps = {
  palette: AppPalette;
  label?: string;
  title?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  motionDelay?: number;
};

export function SectionSurface({
  palette,
  label,
  title,
  children,
  style,
  elevation = 1,
  motionDelay = 0,
}: SectionSurfaceProps) {
  const theme = useTheme<MD3Theme>();
  const surfaceColor =
    elevation === 0
      ? theme.colors.surface
      : theme.colors.elevation[`level${elevation}`];

  return (
    <MotionView delay={motionDelay}>
      <View
        style={[
          styles.shadowWrapper,
          elevation > 0
            ? getShadowStyle(palette.shadow, {
                shadowOpacity: 0.06,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
              })
            : undefined,
          style,
        ]}
      >
        <Surface
          style={[
            styles.card,
            {
              backgroundColor: surfaceColor,
              borderColor: withAlpha(theme.colors.outlineVariant, 0.4),
            },
          ]}
          elevation={0}
        >
          {label || title ? (
            <View style={styles.header}>
              {label ? (
                <View
                  style={[
                    styles.labelBadge,
                    {
                      backgroundColor: withAlpha(palette.accentSoft, 0.7),
                      borderColor: withAlpha(theme.colors.outlineVariant, 0.3),
                    },
                  ]}
                >
                  <Text style={[styles.label, { color: theme.colors.primary }]}>
                    {label}
                  </Text>
                </View>
              ) : null}
              {title ? (
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                  {title}
                </Text>
              ) : null}
            </View>
          ) : null}
          {children}
        </Surface>
      </View>
    </MotionView>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    marginBottom: uiSpace.xxl,
    borderRadius: uiRadius.xl,
  },
  card: {
    borderWidth: uiBorder.hairline,
    borderRadius: uiRadius.xl,
    padding: uiSpace.hero,
    overflow: "hidden",
  },
  header: {
    marginBottom: uiSpace.lg,
  },
  labelBadge: {
    alignSelf: "flex-start",
    borderRadius: uiRadius.pill,
    borderWidth: uiBorder.hairline,
    paddingHorizontal: uiSpace.md,
    paddingVertical: uiSpace.xs,
    marginBottom: uiSpace.sm,
  },
  label: {
    ...uiTypography.microLabel,
    textTransform: "uppercase",
  },
  title: {
    ...uiTypography.titleLg,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});
