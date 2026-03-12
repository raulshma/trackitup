import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    SharedValue,
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import Svg, { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AnimatedVectorLogoProps {
  onAnimationFinish?: () => void;
  shouldAnimate?: boolean;
}

function IsometricBar({
  cx,
  cy,
  size,
  animatedHeight,
  colors,
}: {
  cx: number;
  cy: number;
  size: number;
  animatedHeight: SharedValue<number>;
  colors: { top: string; left: string; right: string };
}) {
  const dx = size * 0.866;
  const dy = size * 0.5;

  const topProps = useAnimatedProps(() => {
    const h = animatedHeight.value;
    const tf = { x: cx, y: cy - h };
    const tl = { x: cx - dx, y: cy - dy - h };
    const tb = { x: cx, y: cy - 2 * dy - h };
    const tr = { x: cx + dx, y: cy - dy - h };
    return {
      d: `M ${tf.x} ${tf.y} L ${tl.x} ${tl.y} L ${tb.x} ${tb.y} L ${tr.x} ${tr.y} Z`,
    };
  });

  const leftProps = useAnimatedProps(() => {
    const h = animatedHeight.value;
    const tf = { x: cx, y: cy - h };
    const tl = { x: cx - dx, y: cy - dy - h };
    const bl = { x: cx - dx, y: cy - dy };
    const bf = { x: cx, y: cy };
    return {
      d: `M ${tf.x} ${tf.y} L ${tl.x} ${tl.y} L ${bl.x} ${bl.y} L ${bf.x} ${bf.y} Z`,
    };
  });

  const rightProps = useAnimatedProps(() => {
    const h = animatedHeight.value;
    const tf = { x: cx, y: cy - h };
    const tr = { x: cx + dx, y: cy - dy - h };
    const br = { x: cx + dx, y: cy - dy };
    const bf = { x: cx, y: cy };
    return {
      d: `M ${tf.x} ${tf.y} L ${tr.x} ${tr.y} L ${br.x} ${br.y} L ${bf.x} ${bf.y} Z`,
    };
  });

  return (
    <G>
      <AnimatedPath animatedProps={leftProps} fill={colors.left} />
      <AnimatedPath animatedProps={rightProps} fill={colors.right} />
      <AnimatedPath animatedProps={topProps} fill={colors.top} />
    </G>
  );
}

export function AnimatedVectorLogo({
  onAnimationFinish,
  shouldAnimate = true,
}: AnimatedVectorLogoProps) {
  const hasStartedRef = useRef(false);

  // Heights of the 4 staircase bars
  const h1 = useSharedValue(0);
  const h2 = useSharedValue(0);
  const h3 = useSharedValue(0);
  const h4 = useSharedValue(0);

  const lineProgress = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    if (!shouldAnimate || hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    // 1. Pop out bars sequentially (Back to Front looks cooler or Front to Back)
    // Front to back so they build "up"
    h1.value = withDelay(100, withSpring(40, { damping: 12, stiffness: 90 }));
    h2.value = withDelay(250, withSpring(80, { damping: 12, stiffness: 90 }));
    h3.value = withDelay(400, withSpring(130, { damping: 12, stiffness: 90 }));
    h4.value = withDelay(550, withSpring(180, { damping: 12, stiffness: 90 }));

    // 2. Draw the tracking line
    lineProgress.value = withDelay(
      1200,
      withTiming(1, {
        duration: 1200,
        easing: Easing.bezier(0.25, 1, 0.5, 1),
      }),
    );

    // 3. Fade in text smoothly
    textOpacity.value = withDelay(1600, withTiming(1, { duration: 1000 }));

    // Finalize
    const timer = setTimeout(() => {
      onAnimationFinish?.();
    }, 3200);

    return () => clearTimeout(timer);
  }, [
    h1,
    h2,
    h3,
    h4,
    lineProgress,
    onAnimationFinish,
    shouldAnimate,
    textOpacity,
  ]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const arrowProps = useAnimatedProps(() => {
    // Exact isometric step values used for bar positioning
    const p0 = { x: 317.5 - 55, y: 448 + 32 - 10 };
    const p1 = { x: 317.5, y: 448 - h1.value - 15 };
    const p2 = { x: 372.5, y: 416 - h2.value - 15 };
    const p3 = { x: 427.5, y: 384 - h3.value - 15 };
    const p4 = { x: 482.5, y: 352 - h4.value - 15 };
    // Fly up to a peak representing future progress
    const p5 = { x: 482.5 + 65, y: 352 - h4.value - 45 };

    return {
      d: `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} L ${p5.x} ${p5.y}`,
      strokeDashoffset: (1 - lineProgress.value) * 800,
    };
  });

  // Bar configs
  const size = 30; // isometric depth size
  const Bar4C = { top: "#34D399", left: "#059669", right: "#10B981" }; // Emerald
  const Bar3C = { top: "#7DD3FC", left: "#0EA5E9", right: "#38BDF8" }; // Sky
  const Bar2C = { top: "#818CF8", left: "#4F46E5", right: "#6366F1" }; // Indigo
  const Bar1C = { top: "#E879F9", left: "#C026D3", right: "#D946EF" }; // Fuchsia

  return (
    <View style={styles.container}>
      <Svg viewBox="0 0 800 800" width={200} height={200}>
        <Defs>
          <LinearGradient
            id="trackerGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#FDE047" />
            <Stop offset="100%" stopColor="#F97316" />
          </LinearGradient>
        </Defs>

        {/* Render Back-to-Front for proper isometric overlap */}
        <G>
          <IsometricBar
            cx={482.5}
            cy={352}
            size={size}
            animatedHeight={h4}
            colors={Bar4C}
          />
          <IsometricBar
            cx={427.5}
            cy={384}
            size={size}
            animatedHeight={h3}
            colors={Bar3C}
          />
          <IsometricBar
            cx={372.5}
            cy={416}
            size={size}
            animatedHeight={h2}
            colors={Bar2C}
          />
          <IsometricBar
            cx={317.5}
            cy={448}
            size={size}
            animatedHeight={h1}
            colors={Bar1C}
          />

          {/* The glowing progress line jumping up the cubes */}
          <AnimatedPath
            fill="none"
            stroke="url(#trackerGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="800"
            animatedProps={arrowProps}
          />
        </G>
      </Svg>

      <Animated.View style={[styles.textContainer, textStyle]}>
        <Text style={styles.title}>
          TRACK<Text style={styles.titleHighlight}>IT</Text>UP
        </Text>
        <Text style={styles.subtitle}>MEASURE YOUR PROGRESS</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  textContainer: {
    position: "absolute",
    top: 220,
    width: 300,
    alignItems: "center",
  },
  title: {
    fontFamily: "Inter",
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 6,
    textAlign: "center",
  },
  titleHighlight: {
    color: "#38BDF8",
  },
  subtitle: {
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
    letterSpacing: 3,
    marginTop: 8,
    textAlign: "center",
  },
});
