import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Surface, useTheme, type MD3Theme } from "react-native-paper";
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

import type { AppPalette } from "@/constants/AppTheme";
import { uiBorder, uiRadius, uiSpace } from "@/constants/UiTokens";

type SkeletonBlockProps = {
  width?: number | `${number}%` | "100%";
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonBlock({
  width = "100%",
  height,
  borderRadius = uiRadius.md,
  style,
}: SkeletonBlockProps) {
  const theme = useTheme<MD3Theme>();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0.5;
      return;
    }

    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1100,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [progress, reduceMotion]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.25, 0.55, 0.25]),
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-72, 184]),
      },
    ],
  }));

  return (
    <View
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.elevation.level2,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            backgroundColor: theme.colors.elevation.level4,
            borderRadius,
            pointerEvents: "none",
          },
          shimmerStyle,
        ]}
      />
    </View>
  );
}

type SkeletonSectionProps = {
  palette: AppPalette;
  titleWidth?: number | `${number}%` | "100%";
  lineWidths?: Array<number | `${number}%` | "100%">;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonSection({
  palette,
  titleWidth = "52%",
  lineWidths = ["100%", "86%", "68%"],
  style,
}: SkeletonSectionProps) {
  const theme = useTheme<MD3Theme>();

  return (
    <Surface
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.elevation.level1,
          borderColor: theme.colors.outlineVariant,
        },
        style,
      ]}
      elevation={1}
    >
      <SkeletonBlock
        width="28%"
        height={26}
        borderRadius={uiRadius.pill}
        style={{
          marginBottom: uiSpace.md,
          backgroundColor: palette.accentSoft,
        }}
      />
      <SkeletonBlock
        width={titleWidth}
        height={24}
        style={styles.sectionTitle}
      />
      {lineWidths.map((lineWidth, index) => (
        <SkeletonBlock
          key={`${String(lineWidth)}-${index}`}
          width={lineWidth}
          height={14}
          style={index === 0 ? undefined : styles.lineGap}
        />
      ))}
    </Surface>
  );
}

type WorkspacePageSkeletonProps = {
  palette: AppPalette;
  sectionCount?: number;
  includeQuickActions?: boolean;
};

export function WorkspacePageSkeleton({
  palette,
  sectionCount = 3,
  includeQuickActions = true,
}: WorkspacePageSkeletonProps) {
  return (
    <>
      <SkeletonSection
        palette={palette}
        titleWidth="58%"
        lineWidths={["100%", "92%", "70%"]}
      />
      {includeQuickActions ? (
        <View style={styles.grid}>
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonBlock
              key={`quick-${index}`}
              width="31%"
              height={118}
              borderRadius={uiRadius.xl}
              style={styles.gridCard}
            />
          ))}
        </View>
      ) : null}
      {Array.from({ length: sectionCount }, (_, index) => (
        <SkeletonSection
          key={`section-${index}`}
          palette={palette}
          lineWidths={["100%", index % 2 === 0 ? "84%" : "74%", "62%"]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 92,
  },
  section: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    marginBottom: uiSpace.xxl,
  },
  sectionTitle: {
    marginBottom: uiSpace.lg,
  },
  lineGap: {
    marginTop: uiSpace.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
    marginBottom: uiSpace.xxl,
  },
  gridCard: {
    flexGrow: 1,
    flexBasis: 220,
  },
});
