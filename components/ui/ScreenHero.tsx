import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Surface, useTheme, type MD3Theme } from "react-native-paper";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import {
    uiBorder,
    uiElevation,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";

export type ScreenHeroBadge = {
  label: string;
  backgroundColor?: string;
  textColor?: string;
};

type ScreenHeroProps = {
  palette: AppPalette;
  title: string;
  subtitle: string;
  eyebrow?: string;
  badges?: ScreenHeroBadge[];
  children?: ReactNode;
};

export function ScreenHero({
  palette,
  title,
  subtitle,
  eyebrow,
  badges = [],
  children,
}: ScreenHeroProps) {
  const theme = useTheme<MD3Theme>();

  return (
    <Surface
      style={[
        styles.hero,
        {
          backgroundColor: palette.hero,
          borderColor: palette.heroBorder,
        },
      ]}
      elevation={uiElevation.hero}
    >
      <View pointerEvents="none" style={styles.ambientLayer}>
        <View
          style={[
            styles.ambientOrb,
            styles.ambientOrbPrimary,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        />
        <View
          style={[
            styles.ambientOrb,
            styles.ambientOrbSecondary,
            { backgroundColor: theme.colors.surface },
          ]}
        />
      </View>
      <View style={styles.content}>
        {badges.length > 0 ? (
          <View style={styles.badgeRow}>
            {badges.map((badge) => (
              <Chip
                key={badge.label}
                compact
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      badge.backgroundColor ?? theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
                textStyle={[
                  styles.badgeText,
                  { color: badge.textColor ?? theme.colors.onSurface },
                ]}
              >
                {badge.label}
              </Chip>
            ))}
          </View>
        ) : null}
        {eyebrow ? (
          <View
            style={[
              styles.eyebrowBadge,
              {
                backgroundColor: theme.colors.surface,
                borderColor: palette.heroBorder,
              },
            ]}
          >
            <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>
              {eyebrow}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {title}
        </Text>
        <Text
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          {subtitle}
        </Text>
        {children ? (
          <View
            style={[
              styles.childrenContainer,
              { borderTopColor: palette.heroBorder },
            ]}
          >
            {children}
          </View>
        ) : null}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.hero,
    padding: uiSpace.hero,
    marginBottom: uiSpace.surface,
    overflow: "hidden",
  },
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  ambientOrb: {
    position: "absolute",
    borderRadius: uiRadius.pill,
    opacity: 0.7,
  },
  ambientOrbPrimary: {
    width: 156,
    height: 156,
    top: -56,
    right: -20,
  },
  ambientOrbSecondary: {
    width: 96,
    height: 96,
    top: 54,
    right: 72,
    opacity: 0.55,
  },
  content: {
    position: "relative",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.sm,
    marginBottom: uiSpace.lg,
  },
  badge: {
    borderRadius: uiRadius.pill,
    borderWidth: uiBorder.hairline,
  },
  badgeText: uiTypography.chip,
  eyebrowBadge: {
    alignSelf: "flex-start",
    borderRadius: uiRadius.pill,
    borderWidth: uiBorder.hairline,
    paddingHorizontal: uiSpace.md,
    paddingVertical: uiSpace.xs,
    marginBottom: uiSpace.md,
  },
  eyebrow: {
    ...uiTypography.heroEyebrow,
  },
  title: {
    ...uiTypography.heroTitle,
    marginBottom: uiSpace.sm,
  },
  subtitle: uiTypography.subtitle,
  childrenContainer: {
    marginTop: uiSpace.surface,
    paddingTop: uiSpace.lg,
    borderTopWidth: uiBorder.hairline,
  },
});
