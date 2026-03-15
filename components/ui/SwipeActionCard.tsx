import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
    Animated,
    PanResponder,
    Pressable,
    StyleSheet,
    View,
    type GestureResponderEvent,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import { useTheme, type MD3Theme } from "react-native-paper";

import { Text } from "@/components/Themed";
import {
    uiBorder,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { triggerSelectionFeedback } from "@/services/device/haptics";

type SwipeAction = {
  label: string;
  onPress: () => void | Promise<void>;
  accentColor?: string;
};

type SwipeActionCardProps = {
  children: ReactNode;
  rightActions?: SwipeAction[];
  leftActions?: SwipeAction[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  actionWidth?: number;
  disabled?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function SwipeActionCard({
  children,
  rightActions = [],
  leftActions = [],
  style,
  contentStyle,
  actionWidth = 92,
  disabled = false,
}: SwipeActionCardProps) {
  const theme = useTheme<MD3Theme>();
  const translateX = useRef(new Animated.Value(0)).current;
  const translateOffsetRef = useRef(0);
  const openOffsetRef = useRef(0);
  const widthRef = useRef(0);
  const maxLeft = leftActions.length * actionWidth;
  const maxRight = rightActions.length * actionWidth;

  const animateTo = (nextValue: number) => {
    openOffsetRef.current = nextValue;
    Animated.spring(translateX, {
      toValue: nextValue,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.6,
    }).start();
  };

  useEffect(() => {
    if (disabled) {
      animateTo(0);
    }
  }, [disabled]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (disabled) return false;
          if (Math.abs(gestureState.dx) < 12) return false;
          if (Math.abs(gestureState.dx) < Math.abs(gestureState.dy) * 1.15) {
            return false;
          }

          if (gestureState.dx < 0 && maxRight > 0) return true;
          if (gestureState.dx > 0 && maxLeft > 0) return true;
          return openOffsetRef.current !== 0;
        },
        onPanResponderGrant: () => {
          translateX.stopAnimation((value) => {
            translateOffsetRef.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const nextValue = clamp(
            translateOffsetRef.current + gestureState.dx,
            -maxRight,
            maxLeft,
          );
          translateX.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          const nextValue = clamp(
            translateOffsetRef.current + gestureState.dx,
            -maxRight,
            maxLeft,
          );
          const threshold = Math.min(
            actionWidth * 0.52,
            widthRef.current * 0.2,
          );

          if (nextValue <= -threshold && maxRight > 0) {
            animateTo(-maxRight);
            return;
          }

          if (nextValue >= threshold && maxLeft > 0) {
            animateTo(maxLeft);
            return;
          }

          if (Math.abs(gestureState.vx) > 0.65) {
            if (gestureState.vx < 0 && maxRight > 0) {
              animateTo(-maxRight);
              return;
            }
            if (gestureState.vx > 0 && maxLeft > 0) {
              animateTo(maxLeft);
              return;
            }
          }

          animateTo(0);
        },
        onPanResponderTerminate: () => {
          animateTo(0);
        },
      }),
    [actionWidth, disabled, maxLeft, maxRight, translateX],
  );

  function handleLayout(event: LayoutChangeEvent) {
    widthRef.current = event.nativeEvent.layout.width;
  }

  function handleActionPress(
    action: SwipeAction,
    event: GestureResponderEvent,
  ) {
    event.stopPropagation();
    animateTo(0);
    triggerSelectionFeedback();
    void action.onPress();
  }

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {leftActions.length > 0 ? (
        <View
          style={[styles.actionRail, styles.leftRail]}
          pointerEvents="box-none"
        >
          {leftActions.map((action) => (
            <Pressable
              key={`left-${action.label}`}
              onPress={(event) => handleActionPress(action, event)}
              style={[
                styles.action,
                {
                  width: actionWidth,
                  backgroundColor: `${action.accentColor ?? theme.colors.secondary}22`,
                  borderColor: `${action.accentColor ?? theme.colors.secondary}33`,
                },
              ]}
            >
              <Text
                style={[
                  styles.actionLabel,
                  { color: action.accentColor ?? theme.colors.secondary },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {rightActions.length > 0 ? (
        <View
          style={[styles.actionRail, styles.rightRail]}
          pointerEvents="box-none"
        >
          {rightActions.map((action) => (
            <Pressable
              key={`right-${action.label}`}
              onPress={(event) => handleActionPress(action, event)}
              style={[
                styles.action,
                {
                  width: actionWidth,
                  backgroundColor: `${action.accentColor ?? theme.colors.primary}22`,
                  borderColor: `${action.accentColor ?? theme.colors.primary}33`,
                },
              ]}
            >
              <Text
                style={[
                  styles.actionLabel,
                  { color: action.accentColor ?? theme.colors.primary },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.content,
          { backgroundColor: theme.colors.surface },
          contentStyle,
          { transform: [{ translateX }] },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: uiRadius.panel,
  },
  content: {
    zIndex: 1,
  },
  actionRail: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "stretch",
  },
  leftRail: {
    justifyContent: "flex-start",
  },
  rightRail: {
    justifyContent: "flex-end",
  },
  action: {
    borderWidth: uiBorder.hairline,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: uiSpace.md,
  },
  actionLabel: {
    ...uiTypography.label,
    textAlign: "center",
    textTransform: "none",
  },
});
