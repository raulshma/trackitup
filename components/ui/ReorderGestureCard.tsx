import { useMemo, useRef, type ReactNode } from "react";
import {
    Animated,
    PanResponder,
    StyleSheet,
    type StyleProp,
    type ViewStyle,
} from "react-native";

import { uiRadius } from "@/constants/UiTokens";
import { triggerSelectionFeedback } from "@/services/device/haptics";

type ReorderGestureCardProps = {
  children: ReactNode;
  axis?: "horizontal" | "vertical";
  onMoveBackward?: () => void;
  onMoveForward?: () => void;
  disabled?: boolean;
  threshold?: number;
  style?: StyleProp<ViewStyle>;
};

export function ReorderGestureCard({
  children,
  axis = "vertical",
  onMoveBackward,
  onMoveForward,
  disabled = false,
  threshold = 42,
  style,
}: ReorderGestureCardProps) {
  const translate = useRef(new Animated.Value(0)).current;

  const resetPosition = () => {
    Animated.spring(translate, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 260,
      mass: 0.5,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (disabled) return false;
          if (axis === "vertical") {
            return (
              Math.abs(gestureState.dy) > 12 &&
              Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.1
            );
          }

          return (
            Math.abs(gestureState.dx) > 12 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1
          );
        },
        onPanResponderMove: (_, gestureState) => {
          translate.setValue(
            axis === "vertical" ? gestureState.dy : gestureState.dx,
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          const delta = axis === "vertical" ? gestureState.dy : gestureState.dx;
          if (delta <= -threshold && onMoveBackward) {
            triggerSelectionFeedback();
            onMoveBackward();
          } else if (delta >= threshold && onMoveForward) {
            triggerSelectionFeedback();
            onMoveForward();
          }

          resetPosition();
        },
        onPanResponderTerminate: resetPosition,
      }),
    [axis, disabled, onMoveBackward, onMoveForward, threshold, translate],
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.wrap,
        style,
        {
          transform:
            axis === "vertical"
              ? [{ translateY: translate }]
              : [{ translateX: translate }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: uiRadius.panel,
  },
});
