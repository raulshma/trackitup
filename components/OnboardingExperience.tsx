import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Button, Chip, SegmentedButtons, Surface } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/Themed";
import { AccentColorPicker } from "@/components/ui/AccentColorPicker";
import { useColorScheme } from "@/components/useColorScheme";
import { getAppPalette } from "@/constants/AppTheme";
import {
  getShadowStyle,
  uiBorder,
  uiElevation,
  uiRadius,
  uiShadow,
  uiSpace,
  uiTypography,
} from "@/constants/UiTokens";
import { useAppAuth } from "@/providers/AuthProvider";
import { useThemePreference } from "@/providers/ThemePreferenceProvider";
import {
  getThemeBackgroundColor,
  type ThemePreference,
} from "@/services/theme/themePreferences";

type OnboardingExperienceProps = {
  onComplete: () => void;
};

type SlideSpec = {
  key: "overview" | "capture" | "personalize";
  badge: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
};

type SymbolName = React.ComponentProps<typeof SymbolView>["name"];

const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  oled: "OLED",
  "monotone-light": "Monotone Light",
  "monotone-dark": "Monotone Dark",
};

const THEME_NOTES: Record<ThemePreference, string> = {
  light: "Bright and airy",
  dark: "Balanced and focused",
  oled: "Pure black contrast",
  "monotone-light": "Clean grayscale clarity",
  "monotone-dark": "High-contrast grayscale",
};

const THEME_SWATCHES: Record<ThemePreference, string> = {
  light: getThemeBackgroundColor("light"),
  dark: getThemeBackgroundColor("dark"),
  oled: getThemeBackgroundColor("oled"),
  "monotone-light": getThemeBackgroundColor("monotone-light"),
  "monotone-dark": getThemeBackgroundColor("monotone-dark"),
};

const FADE_STOPS = [0.94, 0.72, 0.46, 0.22, 0.06];

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .slice(0, 3)
        .split("")
        .map((value) => value + value)
        .join("");
    } else if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }

    if (hex.length === 6) {
      const red = Number.parseInt(hex.slice(0, 2), 16);
      const green = Number.parseInt(hex.slice(2, 4), 16);
      const blue = Number.parseInt(hex.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
  }

  const rgbMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const [red, green, blue] = rgbMatch[1]
      .split(",")
      .map((part) => part.trim())
      .slice(0, 3);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  return color;
}

function EdgeFadeMask({
  color,
  reverse = false,
}: {
  color: string;
  reverse?: boolean;
}) {
  const stops = reverse ? [...FADE_STOPS].reverse() : FADE_STOPS;

  return (
    <View style={[styles.edgeFadeFill, { pointerEvents: "none" }]}>
      {stops.map((opacity, index) => (
        <View
          key={`${opacity}-${index}`}
          style={[
            styles.edgeFadeStep,
            { backgroundColor: withAlpha(color, opacity) },
          ]}
        />
      ))}
    </View>
  );
}

export function OnboardingExperience({
  onComplete,
}: OnboardingExperienceProps) {
  const colorScheme = useColorScheme();
  const palette = getAppPalette(colorScheme);
  const insets = useSafeAreaInsets();
  const auth = useAppAuth();
  const {
    themePreference,
    themeAccentColor,
    setThemePreference,
    setThemeAccentColor,
  } = useThemePreference();
  const [activeIndex, setActiveIndex] = useState(0);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const progressValue = useRef(new Animated.Value(0)).current;

  const slides = useMemo<SlideSpec[]>(
    () => [
      {
        key: "overview",
        badge: "Aesthetic workspace",
        eyebrow: "Welcome to a calmer command center",
        title: "Track spaces, assets, and routines in one refined flow.",
        subtitle:
          "TrackItUp keeps your dashboard polished, your signals clear, and your next action always within reach.",
        accent: palette.tint,
      },
      {
        key: "capture",
        badge: "Fast capture",
        eyebrow: "Move from insight to action in seconds",
        title: "Log updates, scan codes, and keep schedules moving.",
        subtitle:
          "Capture what changed, what needs attention, and what comes next without leaving the rhythm of your workspace.",
        accent: palette.tertiary,
      },
      {
        key: "personalize",
        badge: "Make it yours",
        eyebrow: "Set the mood before you begin",
        title: "Choose a theme that feels right and step into TrackItUp.",
        subtitle:
          "Dial in your preferred look now. You can keep everything private, offline-friendly, and beautifully readable later too.",
        accent: palette.secondary,
      },
    ],
    [palette.secondary, palette.tertiary, palette.tint],
  );

  const isFinalSlide = activeIndex === slides.length - 1;

  const jumpToSlide = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const handleAdvance = useCallback(() => {
    if (isFinalSlide) {
      onComplete();
      return;
    }

    jumpToSlide(activeIndex + 1);
  }, [activeIndex, isFinalSlide, jumpToSlide, onComplete]);

  const handleGoogleSignIn = useCallback(async () => {
    setIsSubmitting(true);
    const result = await auth.signInWithGoogle();
    setAuthMessage(result.message);
    setIsSubmitting(false);

    if (result.status === "success") {
      onComplete();
    }
  }, [auth, onComplete]);

  useEffect(() => {
    Animated.spring(progressValue, {
      toValue: activeIndex,
      useNativeDriver: false,
      stiffness: 210,
      damping: 26,
      mass: 0.9,
    }).start();
  }, [activeIndex, progressValue]);

  const topInsetPadding = uiSpace.lg + Math.max(insets.top, uiSpace.xs);
  const footerBottomPadding = uiSpace.surface + Math.max(insets.bottom, 0);
  const footerGlassColor = withAlpha(
    palette.card,
    colorScheme === "light" ? 0.86 : 0.78,
  );
  const footerBorderColor = withAlpha(
    palette.border,
    colorScheme === "light" ? 0.62 : 0.86,
  );
  const footerSheenColor = withAlpha(
    colorScheme === "light" ? palette.onTint : palette.text,
    colorScheme === "light" ? 0.08 : 0.04,
  );
  const activeSlide = slides[activeIndex];
  const raisedCardShadow = useMemo(
    () => getShadowStyle(palette.shadow, uiShadow.raisedCard),
    [palette.shadow],
  );

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={[styles.backdropLayer, { pointerEvents: "none" }]}>
        <View
          style={[
            styles.backdropOrb,
            styles.orbOne,
            { backgroundColor: palette.hero },
          ]}
        />
        <View
          style={[
            styles.backdropOrb,
            styles.orbTwo,
            { backgroundColor: palette.primaryContainer },
          ]}
        />
        <View
          style={[
            styles.backdropOrb,
            styles.orbThree,
            { backgroundColor: palette.accentSoft },
          ]}
        />
      </View>

      <View style={[styles.topBar, { paddingTop: topInsetPadding }]}>
        <View>
          <Text style={[styles.brandEyebrow, { color: palette.tint }]}>
            Welcome to
          </Text>
          <Text style={styles.brandTitle}>TrackItUp</Text>
        </View>
        <Button
          mode="text"
          textColor={palette.muted}
          onPress={onComplete}
          disabled={isSubmitting}
        >
          Skip
        </Button>
      </View>

      <View style={styles.sliderFrame}>
        <View style={styles.slidePage}>
          <View style={styles.slideViewport}>
            <ScrollView
              key={activeSlide.key}
              style={styles.slideScrollView}
              contentContainerStyle={styles.slideScrollContent}
              scrollEnabled
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Surface
                style={[
                  styles.slideCard,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  },
                  raisedCardShadow,
                ]}
                elevation={uiElevation.hero}
              >
                <View style={styles.badgeRow}>
                  <Chip
                    compact
                    style={[
                      styles.badge,
                      { backgroundColor: palette.accentSoft },
                    ]}
                    textStyle={[styles.badgeText, { color: palette.tint }]}
                  >
                    {activeSlide.badge}
                  </Chip>
                  <Chip
                    compact
                    style={[
                      styles.badge,
                      { backgroundColor: palette.surface2 },
                    ]}
                    textStyle={[styles.badgeText, { color: palette.text }]}
                  >
                    {activeIndex + 1} / {slides.length}
                  </Chip>
                </View>

                <Text
                  style={[styles.slideEyebrow, { color: activeSlide.accent }]}
                >
                  {activeSlide.eyebrow}
                </Text>
                <Text style={styles.slideTitle}>{activeSlide.title}</Text>
                <Text style={[styles.slideSubtitle, { color: palette.muted }]}>
                  {activeSlide.subtitle}
                </Text>

                {activeSlide.key === "overview" ? (
                  <OverviewShowcase
                    palette={palette}
                    raisedCardShadow={raisedCardShadow}
                  />
                ) : activeSlide.key === "capture" ? (
                  <CaptureShowcase palette={palette} />
                ) : (
                  <PersonalizeShowcase
                    palette={palette}
                    themePreference={themePreference}
                    themeAccentColor={themeAccentColor}
                    setThemePreference={setThemePreference}
                    setThemeAccentColor={setThemeAccentColor}
                  />
                )}
              </Surface>
            </ScrollView>

            <View
              style={[
                styles.edgeFade,
                styles.edgeFadeTop,
                { pointerEvents: "none" },
              ]}
            >
              <EdgeFadeMask color={palette.background} />
            </View>
            <View
              style={[
                styles.edgeFade,
                styles.edgeFadeBottom,
                { pointerEvents: "none" },
              ]}
            >
              <EdgeFadeMask color={palette.background} reverse />
            </View>
          </View>
        </View>
      </View>

      <Surface
        style={[
          styles.footer,
          {
            backgroundColor: footerGlassColor,
            borderColor: footerBorderColor,
            paddingBottom: footerBottomPadding,
          },
          raisedCardShadow,
        ]}
        elevation={uiElevation.card}
      >
        <View
          style={[
            styles.footerSheen,
            { backgroundColor: footerSheenColor, pointerEvents: "none" },
          ]}
        />
        <View
          style={[
            styles.footerHighlight,
            {
              backgroundColor: withAlpha(palette.onTint, 0.12),
              pointerEvents: "none",
            },
          ]}
        />
        <View style={styles.footerTopRow}>
          <Text style={[styles.footerCaption, { color: palette.muted }]}>
            Swipe through or tap the dots to preview the experience.
          </Text>
          <View style={styles.progressRow}>
            {slides.map((slide, index) => {
              const isActive = index === activeIndex;
              const dotWidth = progressValue.interpolate({
                inputRange: [index - 1, index, index + 1],
                outputRange: [10, 28, 10],
                extrapolate: "clamp",
              });
              const dotOpacity = progressValue.interpolate({
                inputRange: [index - 1, index, index + 1],
                outputRange: [0.4, 1, 0.4],
                extrapolate: "clamp",
              });

              return (
                <Pressable
                  key={slide.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to slide ${index + 1}`}
                  onPress={() => jumpToSlide(index)}
                  style={styles.progressTapTarget}
                >
                  <View
                    style={[
                      styles.progressDotTrack,
                      {
                        backgroundColor: withAlpha(
                          isActive ? palette.tint : palette.borderSoft,
                          isActive ? 0.22 : 0.88,
                        ),
                      },
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.progressDot,
                        {
                          backgroundColor: palette.tint,
                          width: dotWidth,
                          opacity: dotOpacity,
                        },
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.footerActionStack}>
          {isFinalSlide &&
          auth.clerkPublishableKeyConfigured &&
          !auth.isSignedIn ? (
            <Button
              mode="outlined"
              onPress={handleGoogleSignIn}
              loading={isSubmitting}
              disabled={isSubmitting || !auth.isLoaded}
              style={styles.googleButton}
            >
              Sign in with Google
            </Button>
          ) : null}

          <View style={styles.actionRow}>
            <Button
              mode="text"
              textColor={palette.muted}
              onPress={
                activeIndex === 0
                  ? onComplete
                  : () => jumpToSlide(activeIndex - 1)
              }
              disabled={isSubmitting}
            >
              {activeIndex === 0 ? "Maybe later" : "Back"}
            </Button>
            <Button
              mode="contained"
              onPress={handleAdvance}
              disabled={isSubmitting}
            >
              {isFinalSlide ? "Enter TrackItUp" : "Next"}
            </Button>
          </View>

          {isFinalSlide && authMessage ? (
            <Text style={[styles.authMessage, { color: palette.muted }]}>
              {authMessage}
            </Text>
          ) : null}
        </View>
      </Surface>
    </View>
  );
}

function OverviewShowcase({
  palette,
  raisedCardShadow,
}: {
  palette: ReturnType<typeof getAppPalette>;
  raisedCardShadow: ReturnType<typeof getShadowStyle>;
}) {
  return (
    <View style={styles.showcaseStack}>
      <View style={styles.metricRow}>
        {[
          ["Spaces", "Multi-zone"],
          ["Assets", "Always visible"],
          ["Routines", "On track"],
        ].map(([label, value]) => (
          <View
            key={label}
            style={[
              styles.metricCard,
              {
                backgroundColor: palette.surface1,
                borderColor: palette.borderSoft,
              },
            ]}
          >
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={[styles.metricLabel, { color: palette.muted }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.heroPanel,
          { backgroundColor: palette.hero, borderColor: palette.heroBorder },
        ]}
      >
        {[
          "See everything important at a glance",
          "Keep dashboards neat, structured, and readable",
          "Move from reminders to action without friction",
        ].map((item) => (
          <View key={item} style={styles.listRow}>
            <View style={[styles.listDot, { backgroundColor: palette.tint }]} />
            <Text style={[styles.listCopy, { color: palette.text }]}>
              {item}
            </Text>
          </View>
        ))}

        <View
          style={[
            styles.floatingPanel,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
            raisedCardShadow,
          ]}
        >
          <Text style={styles.floatingTitle}>Today&apos;s pulse</Text>
          <Text style={[styles.floatingMeta, { color: palette.muted }]}>
            Clean signals, quick momentum.
          </Text>
          <View style={styles.inlinePills}>
            <View
              style={[
                styles.inlinePill,
                { backgroundColor: palette.accentSoft },
              ]}
            >
              <Text style={[styles.inlinePillText, { color: palette.tint }]}>
                3 reminders
              </Text>
            </View>
            <View
              style={[styles.inlinePill, { backgroundColor: palette.surface1 }]}
            >
              <Text style={[styles.inlinePillText, { color: palette.text }]}>
                2 scans ready
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function CaptureShowcase({
  palette,
}: {
  palette: ReturnType<typeof getAppPalette>;
}) {
  const features: Array<{
    title: string;
    note: string;
    icon: SymbolName;
  }> = [
    {
      title: "Quick logbook",
      note: "Capture updates without losing context.",
      icon: {
        ios: "list.bullet.rectangle.portrait.fill",
        android: "list",
        web: "list",
      },
    },
    {
      title: "Smart scanner",
      note: "Pull in barcodes and QR links instantly.",
      icon: {
        ios: "barcode.viewfinder",
        android: "qr_code_scanner",
        web: "qr_code_scanner",
      },
    },
    {
      title: "Reminder flow",
      note: "Keep care routines and follow-ups visible.",
      icon: {
        ios: "bell.badge.fill",
        android: "notifications_active",
        web: "notifications_active",
      },
    },
  ];

  return (
    <View style={styles.showcaseStack}>
      <View style={styles.featureGrid}>
        {features.map((feature) => (
          <View
            key={feature.title}
            style={[
              styles.featureCard,
              {
                backgroundColor: palette.surface1,
                borderColor: palette.borderSoft,
              },
            ]}
          >
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: palette.accentSoft },
              ]}
            >
              <SymbolView
                name={feature.icon}
                size={20}
                tintColor={palette.tint}
              />
            </View>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={[styles.featureNote, { color: palette.muted }]}>
              {feature.note}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.timelineStrip,
          {
            backgroundColor: palette.hero,
            borderColor: palette.heroBorder,
          },
        ]}
      >
        {[
          ["Now", "Scan filter label"],
          ["4 PM", "Log maintenance"],
          ["7 PM", "Review reminder queue"],
        ].map(([time, label]) => (
          <View
            key={time}
            style={[
              styles.timelineCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.timelineTime, { color: palette.tint }]}>
              {time}
            </Text>
            <Text style={styles.timelineLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PersonalizeShowcase({
  palette,
  themePreference,
  themeAccentColor,
  setThemePreference,
  setThemeAccentColor,
}: {
  palette: ReturnType<typeof getAppPalette>;
  themePreference: ThemePreference;
  themeAccentColor: string;
  setThemePreference: (preference: ThemePreference) => void;
  setThemeAccentColor: (color: string) => void;
}) {
  return (
    <View style={styles.showcaseStack}>
      <View
        style={[
          styles.preferencePanel,
          {
            backgroundColor: palette.surface1,
            borderColor: palette.borderSoft,
          },
        ]}
      >
        <Text style={styles.preferenceTitle}>Pick your default feel</Text>
        <Text style={[styles.preferenceCopy, { color: palette.muted }]}>
          Match the interface to your space, lighting, and personal taste.
        </Text>
        <SegmentedButtons
          value={themePreference}
          onValueChange={(value) =>
            setThemePreference(value as ThemePreference)
          }
          buttons={Object.entries(THEME_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          style={styles.segmentedButtons}
        />

        <View style={styles.themePreviewGrid}>
          {(Object.keys(THEME_LABELS) as ThemePreference[]).map((option) => {
            const isSelected = option === themePreference;

            return (
              <Pressable
                key={option}
                onPress={() => setThemePreference(option)}
                style={[
                  styles.themePreviewCard,
                  {
                    backgroundColor: palette.card,
                    borderColor: isSelected ? palette.tint : palette.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.previewSwatch,
                    {
                      backgroundColor: THEME_SWATCHES[option],
                      borderColor: palette.borderSoft,
                    },
                  ]}
                />
                <Text style={styles.previewTitle}>{THEME_LABELS[option]}</Text>
                <Text style={[styles.previewNote, { color: palette.muted }]}>
                  {THEME_NOTES[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <AccentColorPicker
          palette={palette}
          value={themeAccentColor}
          onChange={setThemeAccentColor}
          title="Accent color"
          description="Pick a ready-made accent, or drag through the custom picker for a signature color before you enter the app."
        />
      </View>

      <View style={styles.preferenceList}>
        {[
          "Private-by-default settings stay on your device.",
          "Offline-friendly flows keep working when life is busy.",
          "You can tweak themes and preferences again anytime.",
        ].map((item) => (
          <View key={item} style={styles.listRow}>
            <View
              style={[styles.listDot, { backgroundColor: palette.secondary }]}
            />
            <Text style={[styles.listCopy, { color: palette.text }]}>
              {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backdropLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  backdropOrb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.55,
  },
  orbOne: {
    width: 260,
    height: 260,
    top: -60,
    left: -80,
  },
  orbTwo: {
    width: 220,
    height: 220,
    right: -70,
    top: 120,
  },
  orbThree: {
    width: 260,
    height: 260,
    bottom: 90,
    left: 20,
  },
  topBar: {
    paddingHorizontal: uiSpace.screen,
    marginBottom: uiSpace.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandEyebrow: {
    ...uiTypography.label,
    marginBottom: uiSpace.xs,
    textTransform: "uppercase",
  },
  brandTitle: {
    ...uiTypography.titleXl,
  },
  sliderFrame: {
    flex: 1,
    minHeight: 0,
  },
  slider: {
    flex: 1,
    minHeight: 0,
  },
  slidePage: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: uiSpace.screen,
  },
  slideViewport: {
    flex: 1,
    minHeight: 0,
    position: "relative",
  },
  slideScrollView: {
    flex: 1,
    minHeight: 0,
  },
  slideScrollContent: {
    flexGrow: 1,
    minHeight: "100%",
    paddingTop: uiSpace.xs,
    paddingBottom: uiSpace.lg,
  },
  slideCard: {
    flexGrow: 1,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.hero,
    padding: uiSpace.hero,
    gap: uiSpace.md,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.sm,
  },
  badge: {
    borderRadius: uiRadius.pill,
  },
  badgeText: uiTypography.chip,
  slideEyebrow: {
    ...uiTypography.heroEyebrow,
    marginTop: uiSpace.sm,
  },
  slideTitle: {
    ...uiTypography.heroTitle,
  },
  slideSubtitle: {
    ...uiTypography.subtitle,
  },
  showcaseStack: {
    gap: uiSpace.lg,
    marginTop: uiSpace.sm,
  },
  edgeFade: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 28,
  },
  edgeFadeTop: {
    top: 0,
  },
  edgeFadeBottom: {
    bottom: 0,
  },
  edgeFadeFill: {
    flex: 1,
  },
  edgeFadeStep: {
    flex: 1,
  },
  metricRow: {
    flexDirection: "row",
    gap: uiSpace.md,
  },
  metricCard: {
    flex: 1,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.lg,
    padding: uiSpace.lg,
    gap: uiSpace.xs,
  },
  metricValue: uiTypography.titleMd,
  metricLabel: uiTypography.bodySmall,
  heroPanel: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    gap: uiSpace.md,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiSpace.md,
  },
  listDot: {
    width: 10,
    height: 10,
    borderRadius: uiRadius.pill,
  },
  listCopy: {
    ...uiTypography.body,
    flex: 1,
  },
  floatingPanel: {
    marginTop: uiSpace.sm,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    gap: uiSpace.xs,
  },
  floatingTitle: uiTypography.titleMd,
  floatingMeta: uiTypography.bodySmall,
  inlinePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.sm,
    marginTop: uiSpace.sm,
  },
  inlinePill: {
    paddingHorizontal: uiSpace.lg,
    paddingVertical: uiSpace.sm,
    borderRadius: uiRadius.pill,
  },
  inlinePillText: uiTypography.bodySmall,
  featureGrid: {
    gap: uiSpace.md,
  },
  featureCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    gap: uiSpace.sm,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: uiRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: uiTypography.titleMd,
  featureNote: uiTypography.bodySmall,
  timelineStrip: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    gap: uiSpace.md,
  },
  timelineCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.lg,
    padding: uiSpace.lg,
    gap: uiSpace.xs,
  },
  timelineTime: uiTypography.label,
  timelineLabel: uiTypography.body,
  preferencePanel: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    gap: uiSpace.md,
  },
  preferenceTitle: uiTypography.titleLg,
  preferenceCopy: uiTypography.body,
  segmentedButtons: {
    marginTop: uiSpace.xs,
  },
  themePreviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
  },
  themePreviewCard: {
    flexBasis: "48%",
    flexGrow: 1,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.lg,
    padding: uiSpace.md,
    gap: uiSpace.sm,
  },
  previewSwatch: {
    height: 42,
    borderRadius: uiRadius.md,
    borderWidth: uiBorder.standard,
  },
  previewTitle: uiTypography.titleSm,
  previewNote: uiTypography.support,
  preferenceList: {
    gap: uiSpace.md,
  },
  footer: {
    marginTop: uiSpace.surface,
    marginHorizontal: uiSpace.screen,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    gap: uiSpace.lg,
    overflow: "hidden",
  },
  footerSheen: {
    ...StyleSheet.absoluteFillObject,
  },
  footerHighlight: {
    position: "absolute",
    top: 0,
    left: uiSpace.surface,
    right: uiSpace.surface,
    height: 1,
  },
  footerTopRow: {
    gap: uiSpace.md,
  },
  footerCaption: uiTypography.bodySmall,
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiSpace.sm,
  },
  progressTapTarget: {
    paddingVertical: uiSpace.xs,
  },
  progressDotTrack: {
    width: 28,
    height: 10,
    borderRadius: uiRadius.pill,
    justifyContent: "center",
  },
  progressDot: {
    height: 10,
    borderRadius: uiRadius.pill,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerActionStack: {
    gap: uiSpace.md,
  },
  googleButton: {
    width: "100%",
  },
  authMessage: uiTypography.bodySmall,
});
