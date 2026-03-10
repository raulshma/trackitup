import BootSplash from "react-native-bootsplash";
import { useState, useEffect } from "react";
import { Animated, StyleSheet } from "react-native";
import { AnimatedVectorLogo } from "./AnimatedVectorLogo";

type Props = {
  children: React.ReactNode;
  onAnimationEnd?: () => void;
  isReady: boolean;
};

export function AnimatedSplashScreen({ children, onAnimationEnd, isReady }: Props) {
  const [visible, setVisible] = useState(true);
  const [svgAnimationFinished, setSvgAnimationFinished] = useState(false);
  const opacity = useState(new Animated.Value(1))[0];

  useEffect(() => {
    // Hide the NATIVE BootSplash immediately when this React component mounts.
    // This allows our custom 60FPS React Native SVG animation to instantly take over the screen visually!
    BootSplash.hide();
  }, []);

  // Wait until the App is fully ready AND the beautiful vector animation finishes playing its first loop.
  useEffect(() => {
    if (isReady && svgAnimationFinished && visible) {
      Animated.timing(opacity, {
        useNativeDriver: true,
        toValue: 0,
        duration: 800, // Smooth slow fadeout of the whole background
      }).start(() => {
        setVisible(false);
        onAnimationEnd?.();
      });
    }
  }, [isReady, svgAnimationFinished, visible]);

  return (
    <>
      {children}

      {visible && (
        <Animated.View style={[styles.container, { opacity }]}>
          <AnimatedVectorLogo 
            onAnimationFinish={() => setSvgAnimationFinished(true)} 
          />
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
});
