import { SymbolView } from "expo-symbols";
import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Appbar, type MD3Theme, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    uiBorder,
    uiRadius,
    uiSize,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";

type HeaderSymbolName = React.ComponentProps<typeof SymbolView>["name"];

export type MaterialCompactTopAppBarAction = {
  icon: HeaderSymbolName;
  accessibilityLabel: string;
  onPress: () => void;
};

type MaterialCompactTopAppBarProps = {
  title: string;
  canGoBack?: boolean;
  onBack?: () => void;
  leadingAction?: MaterialCompactTopAppBarAction;
  actions?: MaterialCompactTopAppBarAction[];
  showBrand?: boolean;
  scrollY?: Animated.Value;
};

const COMPACT_TOP_APP_BAR_HEIGHT = uiSize.topAppBarHeight;
const HEADER_RELEASE_OFFSET = 12;
const HEADER_FADE_DISTANCE = 72;
const HEADER_COLLAPSE_DISTANCE = 112;

export function useMaterialCompactTopAppBarHeight() {
  const insets = useSafeAreaInsets();

  return COMPACT_TOP_APP_BAR_HEIGHT + insets.top;
}

function createSymbolIcon(name: HeaderSymbolName) {
  return ({ color, size }: { color: string; size: number }) => (
    <SymbolView name={name} size={size} tintColor={color} />
  );
}

export function MaterialCompactTopAppBar({
  title,
  canGoBack = false,
  onBack,
  leadingAction,
  actions = [],
  showBrand = false,
  scrollY,
}: MaterialCompactTopAppBarProps) {
  const theme = useTheme<MD3Theme>();
  const insets = useSafeAreaInsets();
  const totalHeaderHeight = useMaterialCompactTopAppBarHeight();
  const clampedScrollY = React.useMemo(
    () =>
      scrollY ? Animated.diffClamp(scrollY, 0, HEADER_COLLAPSE_DISTANCE) : null,
    [scrollY],
  );
  const actionColor = showBrand
    ? theme.colors.onSecondaryContainer
    : theme.colors.onSurfaceVariant;
  const actionContainerColor = showBrand
    ? theme.colors.secondaryContainer
    : theme.colors.elevation.level1;
  const hasLeadingAction = canGoBack || Boolean(leadingAction);
  const animatedContainerStyle = React.useMemo(() => {
    if (!clampedScrollY) {
      return {
        height: totalHeaderHeight,
        opacity: 1,
      };
    }

    return {
      height: totalHeaderHeight,
      opacity: clampedScrollY.interpolate({
        inputRange: [
          0,
          HEADER_RELEASE_OFFSET,
          HEADER_RELEASE_OFFSET + 24,
          HEADER_RELEASE_OFFSET + HEADER_FADE_DISTANCE,
        ],
        outputRange: [1, 1, 0.72, 0],
        extrapolate: "clamp",
      }),
      transform: [
        {
          translateY: clampedScrollY.interpolate({
            inputRange: [0, HEADER_RELEASE_OFFSET, HEADER_COLLAPSE_DISTANCE],
            outputRange: [0, 0, -totalHeaderHeight],
            extrapolate: "clamp",
          }),
        },
      ],
    };
  }, [clampedScrollY, totalHeaderHeight]);

  return (
    <Animated.View
      style={[
        styles.container,
        animatedContainerStyle,
        {
          backgroundColor: theme.colors.elevation.level1,
          paddingTop: insets.top,
        },
      ]}
    >
      <Appbar.Header
        mode="small"
        elevated={false}
        statusBarHeight={0}
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.elevation.level1,
            borderBottomColor: theme.colors.outlineVariant,
          },
        ]}
      >
        {canGoBack ? (
          <Appbar.BackAction
            accessibilityLabel="Go back"
            color={theme.colors.onSurfaceVariant}
            onPress={onBack}
            style={[
              styles.leadingAction,
              {
                backgroundColor: theme.colors.elevation.level2,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          />
        ) : leadingAction ? (
          <Appbar.Action
            accessibilityLabel={leadingAction.accessibilityLabel}
            color={theme.colors.onSurfaceVariant}
            icon={createSymbolIcon(leadingAction.icon)}
            onPress={leadingAction.onPress}
            size={18}
            style={[
              styles.leadingAction,
              {
                backgroundColor: theme.colors.elevation.level2,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          />
        ) : null}
        {showBrand ? (
          <Appbar.Content
            color={theme.colors.onSurface}
            style={[
              styles.content,
              hasLeadingAction ? styles.contentWithLeading : styles.contentRoot,
            ]}
            title={
              <View style={styles.brandRow}>
                <View
                  style={[
                    styles.brandBadge,
                    {
                      backgroundColor: theme.colors.elevation.level2,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.brandBadgeText,
                      { color: theme.colors.onPrimaryContainer },
                    ]}
                  >
                    TIU
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.title, { color: theme.colors.onSurface }]}
                >
                  {title}
                </Text>
              </View>
            }
            titleMaxFontSizeMultiplier={1.1}
          />
        ) : (
          <Appbar.Content
            color={theme.colors.onSurface}
            style={[
              styles.content,
              hasLeadingAction ? styles.contentWithLeading : styles.contentRoot,
            ]}
            title={title}
            titleMaxFontSizeMultiplier={1.1}
            titleStyle={[styles.title, { color: theme.colors.onSurface }]}
          />
        )}
        {actions.map((action) => (
          <Appbar.Action
            key={action.accessibilityLabel}
            accessibilityLabel={action.accessibilityLabel}
            color={actionColor}
            icon={createSymbolIcon(action.icon)}
            onPress={action.onPress}
            size={18}
            style={[
              styles.action,
              {
                backgroundColor: actionContainerColor,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          />
        ))}
      </Appbar.Header>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    zIndex: 10,
  },
  header: {
    height: COMPACT_TOP_APP_BAR_HEIGHT,
    borderBottomWidth: uiBorder.hairline,
    paddingHorizontal: uiSpace.xs,
  },
  leadingAction: {
    marginLeft: 0,
    marginRight: 0,
    width: uiSize.headerAction,
    height: uiSize.headerAction,
    borderRadius: uiRadius.md,
    borderWidth: uiBorder.hairline,
  },
  content: {
    marginLeft: 0,
    minWidth: 0,
  },
  contentWithLeading: {
    marginLeft: uiSpace.sm,
  },
  contentRoot: {
    marginLeft: uiSpace.sm,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiSpace.sm,
    minWidth: 0,
  },
  brandBadge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: uiSpace.sm,
    borderRadius: uiRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: uiBorder.hairline,
  },
  brandBadgeText: {
    ...uiTypography.microLabel,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  title: {
    ...uiTypography.titleMd,
    fontWeight: "600",
    letterSpacing: 0.15,
    flexShrink: 1,
  },
  action: {
    marginLeft: uiSpace.sm,
    marginRight: 0,
    width: uiSize.headerAction,
    height: uiSize.headerAction,
    borderWidth: uiBorder.hairline,
    borderRadius: uiRadius.md,
  },
});
