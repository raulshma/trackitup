import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Surface } from "react-native-paper";

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
  return (
    <Surface
      style={[
        styles.hero,
        { backgroundColor: palette.hero, borderColor: palette.heroBorder },
      ]}
      elevation={uiElevation.hero}
    >
      {badges.length > 0 ? (
        <View style={styles.badgeRow}>
          {badges.map((badge) => (
            <Chip
              key={badge.label}
              compact
              style={[
                styles.badge,
                { backgroundColor: badge.backgroundColor ?? palette.card },
              ]}
              textStyle={[
                styles.badgeText,
                { color: badge.textColor ?? palette.text },
              ]}
            >
              {badge.label}
            </Chip>
          ))}
        </View>
      ) : null}
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: palette.tint }]}>{eyebrow}</Text>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.subtitle, { color: palette.muted }]}>
        {subtitle}
      </Text>
      {children}
    </Surface>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.hero,
    padding: uiSpace.hero,
    marginBottom: uiSpace.surface,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.sm,
    marginBottom: uiSpace.lg,
  },
  badge: {
    borderRadius: uiRadius.pill,
  },
  badgeText: uiTypography.chip,
  eyebrow: {
    ...uiTypography.heroEyebrow,
    marginBottom: uiSpace.sm,
  },
  title: {
    ...uiTypography.heroTitle,
    marginBottom: uiSpace.sm,
  },
  subtitle: uiTypography.subtitle,
});
