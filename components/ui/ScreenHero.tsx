import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Surface } from "react-native-paper";

import { Text } from "@/components/Themed";
import Colors from "@/constants/Colors";

type AppPalette = (typeof Colors)[keyof typeof Colors];

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
      elevation={2}
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
      {eyebrow ? <Text style={[styles.eyebrow, { color: palette.tint }]}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.subtitle, { color: palette.muted }]}>{subtitle}</Text>
      {children}
    </Surface>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
});