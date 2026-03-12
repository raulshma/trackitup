import { useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Surface, useTheme, type MD3Theme } from "react-native-paper";
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import {
    uiBorder,
    uiElevation,
    uiMotion,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { MotionView } from "./Motion";

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
  const reduceMotion = useReducedMotion();
  const ambientProgress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      ambientProgress.value = 0;
      return;
    }

    ambientProgress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(0, {
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );
  }, [ambientProgress, reduceMotion]);

  const primaryOrbStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ambientProgress.value, [0, 1], [0.6, 0.82]),
    transform: [
      {
        translateX: interpolate(ambientProgress.value, [0, 1], [0, -10]),
      },
      {
        translateY: interpolate(ambientProgress.value, [0, 1], [0, 10]),
      },
      {
        scale: interpolate(ambientProgress.value, [0, 1], [1, 1.05]),
      },
    ],
  }));

  const secondaryOrbStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ambientProgress.value, [0, 1], [0.42, 0.62]),
    transform: [
      {
        translateX: interpolate(ambientProgress.value, [0, 1], [0, 8]),
      },
      {
        translateY: interpolate(ambientProgress.value, [0, 1], [0, -8]),
      },
      {
        scale: interpolate(ambientProgress.value, [0, 1], [1, 1.08]),
      },
    ],
  }));

  return (
    <MotionView delay={uiMotion.stagger} fromScale={0.975}>
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
          <Animated.View
            style={[
              styles.ambientOrb,
              styles.ambientOrbPrimary,
              { backgroundColor: theme.colors.primaryContainer },
              primaryOrbStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.ambientOrb,
              styles.ambientOrbSecondary,
              { backgroundColor: theme.colors.surface },
              secondaryOrbStyle,
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
    </MotionView>
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
