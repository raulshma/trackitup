import { useEffect, type ReactNode } from "react";
import {
    Platform,
    Pressable,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from "react-native-reanimated";

import { uiMotion } from "@/constants/UiTokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type MotionViewProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  fromY?: number;
  fromScale?: number;
  disabled?: boolean;
};

export function MotionView({
  children,
  style,
  delay = 0,
  fromY = uiMotion.enterOffset,
  fromScale = 0.985,
  disabled = false,
}: MotionViewProps) {
  const reduceMotion = useReducedMotion();
  const shouldSkipEnterAnimation =
    disabled ||
    reduceMotion ||
    (Platform.OS !== "ios" && delay >= uiMotion.stagger * 3);
  const progress = useSharedValue(shouldSkipEnterAnimation ? 1 : 0);

  useEffect(() => {
    if (shouldSkipEnterAnimation) {
      progress.value = 1;
      return;
    }

    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: uiMotion.slow,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [delay, progress, shouldSkipEnterAnimation]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [fromY, 0]),
      },
      {
        scale: interpolate(progress.value, [0, 1], [fromScale, 1]),
      },
    ],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}

type MotionPressableProps = Omit<PressableProps, "children" | "style"> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hoverScaleTo?: number;
  hoverLift?: number;
};

export function MotionPressable({
  children,
  disabled,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  scaleTo = uiMotion.pressScale,
  hoverScaleTo = uiMotion.hoverScale,
  hoverLift = uiMotion.hoverLift,
  style,
  ...pressableProps
}: MotionPressableProps) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const hovered = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion || disabled) {
      return {
        transform: [{ translateY: 0 }, { scale: 1 }],
      };
    }

    const targetScale = pressed.value
      ? scaleTo
      : hovered.value
        ? hoverScaleTo
        : 1;
    const targetTranslateY = pressed.value ? 1 : hovered.value ? -hoverLift : 0;

    return {
      transform: [
        {
          translateY: withTiming(targetTranslateY, {
            duration: uiMotion.quick,
            easing: Easing.out(Easing.quad),
          }),
        },
        {
          scale: withSpring(targetScale, {
            damping: 18,
            stiffness: 260,
            mass: 0.5,
          }),
        },
      ],
    };
  });

  return (
    <AnimatedPressable
      {...pressableProps}
      disabled={disabled}
      onHoverIn={(event) => {
        hovered.value = 1;
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        hovered.value = 0;
        onHoverOut?.(event);
      }}
      onPressIn={(event) => {
        pressed.value = 1;
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = 0;
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
