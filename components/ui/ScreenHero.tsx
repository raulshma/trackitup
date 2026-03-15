import { useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, useTheme, type MD3Theme } from "react-native-paper";
import { BlurView } from "expo-blur";
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
import { useColorScheme } from "@/components/useColorScheme";
import { withAlpha } from "@/constants/Colors";
import type { AppPalette } from "@/constants/AppTheme";
import {
    getShadowStyle,
    uiBorder,
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
  const colorScheme = useColorScheme();
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
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
  }, [ambientProgress, reduceMotion]);

  const primaryOrbStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ambientProgress.value, [0, 1], [0.65, 0.9]),
    transform: [
      { translateX: interpolate(ambientProgress.value, [0, 1], [0, -15]) },
      { translateY: interpolate(ambientProgress.value, [0, 1], [0, 15]) },
      { scale: interpolate(ambientProgress.value, [0, 1], [1, 1.1]) },
    ],
  }));

  const secondaryOrbStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ambientProgress.value, [0, 1], [0.45, 0.7]),
    transform: [
      { translateX: interpolate(ambientProgress.value, [0, 1], [0, 12]) },
      { translateY: interpolate(ambientProgress.value, [0, 1], [0, -12]) },
      { scale: interpolate(ambientProgress.value, [0, 1], [1, 1.15]) },
    ],
  }));

  return (
    <MotionView delay={uiMotion.stagger} fromScale={0.96}>
      <View
        style={[
          styles.heroShadowWrapper,
          getShadowStyle(palette.shadow, {
            shadowOpacity: 0.12,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
          }),
        ]}
      >
        <View
          style={[
            styles.heroContainer,
            { borderColor: withAlpha(palette.heroBorder, 0.5) },
          ]}
        >
          <View style={[styles.ambientLayer, { backgroundColor: palette.hero }]}>
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
                { backgroundColor: theme.colors.tertiaryContainer },
                secondaryOrbStyle,
              ]}
            />
          </View>
          
          <BlurView
            intensity={colorScheme === "dark" ? 30 : 50}
            tint={colorScheme === "dark" ? "dark" : "light"}
            style={StyleSheet.absoluteFillObject}
          />
          
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: withAlpha(palette.hero, 0.35) },
            ]}
          />

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
                        backgroundColor: withAlpha(
                          badge.backgroundColor ?? theme.colors.surface,
                          0.7
                        ),
                        borderColor: withAlpha(theme.colors.outlineVariant, 0.5),
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
                    backgroundColor: withAlpha(theme.colors.surface, 0.6),
                    borderColor: withAlpha(palette.heroBorder, 0.4),
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
              style={[
                styles.subtitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {subtitle}
            </Text>
            {children ? (
              <View
                style={[
                  styles.childrenContainer,
                  { borderTopColor: withAlpha(palette.heroBorder, 0.4) },
                ]}
              >
                {children}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </MotionView>
  );
}

const styles = StyleSheet.create({
  heroShadowWrapper: {
    marginBottom: uiSpace.surface,
    borderRadius: uiRadius.hero,
  },
  heroContainer: {
    borderWidth: uiBorder.hairline,
    borderRadius: uiRadius.hero,
    overflow: "hidden",
    position: "relative",
  },
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  ambientOrb: {
    position: "absolute",
    borderRadius: uiRadius.pill,
    opacity: 0.8,
  },
  ambientOrbPrimary: {
    width: 200,
    height: 200,
    top: -80,
    right: -40,
  },
  ambientOrbSecondary: {
    width: 140,
    height: 140,
    bottom: -40,
    left: -20,
    opacity: 0.65,
  },
  content: {
    position: "relative",
    padding: uiSpace.hero,
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
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    ...uiTypography.subtitle,
    lineHeight: 24,
  },
  childrenContainer: {
    marginTop: uiSpace.surface,
    paddingTop: uiSpace.lg,
    borderTopWidth: uiBorder.hairline,
  },
});
