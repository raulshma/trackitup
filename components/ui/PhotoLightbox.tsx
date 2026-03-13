import { useEffect, useMemo, useRef, useState } from "react";
import {
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from "react-native";
import { Button, Chip } from "react-native-paper";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import { withAlpha } from "@/constants/Colors";
import {
    getShadowStyle,
    uiBorder,
    uiRadius,
    uiShadow,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

export type LightboxItem = {
  id: string;
  uri: string;
  title: string;
  subtitle?: string;
  badge?: string;
};

type PhotoLightboxProps = {
  visible: boolean;
  palette: AppPalette;
  items: LightboxItem[];
  initialIndex: number;
  onRequestClose: () => void;
};

export function PhotoLightbox({
  visible,
  palette,
  items,
  initialIndex,
  onRequestClose,
}: PhotoLightboxProps) {
  const listRef = useRef<FlatList<LightboxItem> | null>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    if (!visible) return;
    if (items.length === 0) return;
    const nextIndex = Math.max(0, Math.min(initialIndex, items.length - 1));
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ animated: false, index: nextIndex });
    });
  }, [initialIndex, items.length, visible]);

  const activeItem = useMemo(
    () => items[Math.max(0, Math.min(activeIndex, items.length - 1))],
    [activeIndex, items],
  );
  const pagerDotIndices = useMemo(() => {
    if (items.length <= 5) {
      return items.map((_, index) => index);
    }

    const startIndex = Math.max(0, Math.min(activeIndex - 2, items.length - 5));
    return Array.from({ length: 5 }, (_, offset) => startIndex + offset);
  }, [activeIndex, items]);
  const panelShadow = useMemo(
    () => getShadowStyle(palette.shadow, uiShadow.raisedCard),
    [palette.shadow],
  );

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
    );
    setActiveIndex(Math.max(0, Math.min(nextIndex, items.length - 1)));
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      hardwareAccelerated={Platform.OS === "android"}
      statusBarTranslucent={Platform.OS === "android"}
      onRequestClose={onRequestClose}
    >
      <View
        style={[
          styles.backdrop,
          { backgroundColor: withAlpha(palette.inverseSurface, 0.94) },
        ]}
      >
        <View style={styles.chrome}>
          <View
            style={[
              styles.headerPanel,
              {
                backgroundColor: withAlpha(palette.inverseSurface, 0.72),
                borderColor: withAlpha(palette.inverseOnSurface, 0.12),
              },
              panelShadow,
            ]}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text
                  style={[
                    styles.headerTitle,
                    { color: palette.inverseOnSurface },
                  ]}
                >
                  {activeItem?.title ?? "Photo"}
                </Text>
                {activeItem?.subtitle ? (
                  <Text
                    style={[
                      styles.headerSubtitle,
                      { color: palette.inverseOnSurface },
                    ]}
                  >
                    {activeItem.subtitle}
                  </Text>
                ) : null}
              </View>
              <Button mode="contained-tonal" onPress={onRequestClose}>
                Close
              </Button>
            </View>
          </View>

          <FlatList
            ref={listRef}
            data={items}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={handleMomentumEnd}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews={Platform.OS === "android"}
            renderItem={({ item }) => (
              <View style={styles.slide}>
                <ScrollView
                  style={styles.zoomFrame}
                  contentContainerStyle={styles.slidePressable}
                  minimumZoomScale={1}
                  maximumZoomScale={4}
                  pinchGestureEnabled
                  bouncesZoom
                  centerContent
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                >
                  <View
                    style={[
                      styles.imageFrame,
                      {
                        borderColor: withAlpha(palette.inverseOnSurface, 0.12),
                        backgroundColor: withAlpha(
                          palette.inverseOnSurface,
                          0.05,
                        ),
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  </View>
                </ScrollView>
              </View>
            )}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />

          <View
            style={[
              styles.footerPanel,
              {
                backgroundColor: withAlpha(palette.inverseSurface, 0.72),
                borderColor: withAlpha(palette.inverseOnSurface, 0.12),
              },
              panelShadow,
            ]}
          >
            <View style={styles.footerRow}>
              <Chip
                compact
                style={[
                  styles.indexChip,
                  {
                    backgroundColor: withAlpha(palette.inverseOnSurface, 0.12),
                  },
                ]}
                textStyle={{ color: palette.inverseOnSurface }}
              >
                {items.length === 0
                  ? "0 / 0"
                  : `${activeIndex + 1} / ${items.length}`}
              </Chip>
              {activeItem?.badge ? (
                <Chip
                  compact
                  style={[
                    styles.indexChip,
                    {
                      backgroundColor: withAlpha(
                        palette.inverseOnSurface,
                        0.12,
                      ),
                    },
                  ]}
                  textStyle={{ color: palette.inverseOnSurface }}
                >
                  {activeItem.badge}
                </Chip>
              ) : null}
              <Chip
                compact
                style={[
                  styles.indexChip,
                  {
                    backgroundColor: withAlpha(palette.inverseOnSurface, 0.12),
                  },
                ]}
                textStyle={{ color: palette.inverseOnSurface }}
              >
                Swipe + pinch to zoom
              </Chip>
            </View>
            <View style={styles.pagerRow}>
              {pagerDotIndices.map((index) => (
                <View
                  key={`${items[index]?.id ?? index}`}
                  style={[
                    styles.pagerDot,
                    {
                      opacity: index === activeIndex ? 1 : 0.4,
                      backgroundColor:
                        index === activeIndex
                          ? palette.inverseOnSurface
                          : withAlpha(palette.inverseOnSurface, 0.7),
                      transform: [{ scale: index === activeIndex ? 1.15 : 1 }],
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  chrome: {
    flex: 1,
    paddingTop: uiSpace.hero,
    paddingBottom: uiSpace.screenBottom,
  },
  headerPanel: {
    marginHorizontal: uiSpace.screen,
    marginBottom: uiSpace.md,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.hero,
    paddingHorizontal: uiSpace.surface,
    paddingVertical: uiSpace.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: uiSpace.md,
  },
  headerCopy: { flex: 1, gap: 4 },
  headerTitle: uiTypography.titleLg,
  headerSubtitle: uiTypography.bodySmall,
  slide: {
    width: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: uiSpace.screen,
  },
  slidePressable: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomFrame: {
    width: "100%",
  },
  imageFrame: {
    borderRadius: uiRadius.hero,
    overflow: "hidden",
    borderWidth: uiBorder.standard,
  },
  image: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.72,
  },
  footerPanel: {
    marginHorizontal: uiSpace.screen,
    marginTop: uiSpace.md,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.hero,
    paddingHorizontal: uiSpace.surface,
    paddingVertical: uiSpace.md,
  },
  footerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.sm,
  },
  pagerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: uiSpace.sm,
    marginTop: uiSpace.md,
  },
  pagerDot: {
    width: 8,
    height: 8,
    borderRadius: uiRadius.pill,
  },
  indexChip: {
    borderRadius: uiRadius.pill,
  },
});
