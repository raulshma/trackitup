import { useMemo, useState } from "react";
import {
    Image,
    PanResponder,
    StyleSheet,
    View,
    type LayoutChangeEvent,
} from "react-native";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import { withAlpha } from "@/constants/Colors";
import { uiRadius, uiSpace, uiTypography } from "@/constants/UiTokens";

type BeforeAfterSliderProps = {
  palette: AppPalette;
  beforeUri: string;
  afterUri: string;
  beforeLabel: string;
  afterLabel: string;
  height?: number;
};

export function BeforeAfterSlider({
  palette,
  beforeUri,
  afterUri,
  beforeLabel,
  afterLabel,
  height = 240,
}: BeforeAfterSliderProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [sliderRatio, setSliderRatio] = useState(0.5);

  function updateRatio(nextX: number) {
    if (containerWidth <= 0) return;
    const clamped = Math.max(0, Math.min(nextX / containerWidth, 1));
    setSliderRatio(clamped);
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) =>
          updateRatio(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updateRatio(event.nativeEvent.locationX),
      }),
    [containerWidth],
  );

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  const overlayWidth = Math.max(0, containerWidth * sliderRatio);

  return (
    <View style={styles.container}>
      <View
        {...panResponder.panHandlers}
        style={[styles.frame, { height, backgroundColor: palette.surface2 }]}
        onLayout={handleLayout}
      >
        <Image
          source={{ uri: afterUri }}
          style={styles.fullImage}
          resizeMode="cover"
        />
        <View style={[styles.overlayClip, { width: overlayWidth }]}>
          <Image
            source={{ uri: beforeUri }}
            style={styles.fullImage}
            resizeMode="cover"
          />
        </View>
        <View
          style={[
            styles.handleTrack,
            {
              left: overlayWidth,
              backgroundColor: withAlpha(palette.inverseOnSurface, 0.85),
            },
          ]}
        >
          <View
            style={[
              styles.handleKnob,
              {
                borderColor: palette.inverseSurface,
                backgroundColor: withAlpha(palette.inverseOnSurface, 0.92),
              },
            ]}
          />
        </View>
        <View style={styles.badgeRow}>
          <View
            style={[styles.badge, { backgroundColor: palette.inverseSurface }]}
          >
            <Text
              style={[styles.badgeText, { color: palette.inverseOnSurface }]}
            >
              {beforeLabel}
            </Text>
          </View>
          <View
            style={[styles.badge, { backgroundColor: palette.inverseSurface }]}
          >
            <Text
              style={[styles.badgeText, { color: palette.inverseOnSurface }]}
            >
              {afterLabel}
            </Text>
          </View>
        </View>
      </View>
      <Text style={[styles.caption, { color: palette.muted }]}>
        Drag the divider to compare progress.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: uiSpace.sm },
  frame: {
    overflow: "hidden",
    borderRadius: uiRadius.xl,
  },
  fullImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  overlayClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  handleTrack: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    alignItems: "center",
    justifyContent: "center",
  },
  handleKnob: {
    width: 32,
    height: 32,
    borderRadius: uiRadius.pill,
    borderWidth: 2,
  },
  badgeRow: {
    position: "absolute",
    top: uiSpace.md,
    left: uiSpace.md,
    right: uiSpace.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  badge: {
    borderRadius: uiRadius.pill,
    paddingHorizontal: uiSpace.md,
    paddingVertical: 6,
  },
  badgeText: uiTypography.label,
  caption: uiTypography.bodySmall,
});
