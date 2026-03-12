import { useEffect, useState } from "react";
import { Animated, Image, Platform, StyleSheet } from "react-native";
import BootSplash from "react-native-bootsplash";

import {
    DEFAULT_THEME_PREFERENCE,
    getThemeBackgroundColor,
} from "@/services/theme/themePreferences";

import { AnimatedVectorLogo } from "./AnimatedVectorLogo";

const SPLASH_BACKGROUND_COLOR = getThemeBackgroundColor(
  DEFAULT_THEME_PREFERENCE,
);

type Props = {
  children: React.ReactNode;
  onAnimationEnd?: () => void;
  isReady: boolean;
};

export function AnimatedSplashScreen({
  children,
  onAnimationEnd,
  isReady,
}: Props) {
  const [visible, setVisible] = useState(true);
  const [splashOverlayVisible, setSplashOverlayVisible] = useState(
    Platform.OS !== "web",
  );
  const [vectorAnimationStarted, setVectorAnimationStarted] = useState(
    Platform.OS === "web",
  );
  const [svgAnimationFinished, setSvgAnimationFinished] = useState(false);
  const opacity = useState(new Animated.Value(1))[0];
  const splashOpacity = useState(new Animated.Value(1))[0];
  const vectorOpacity = useState(
    new Animated.Value(Platform.OS === "web" ? 1 : 0),
  )[0];

  const shouldUseNativeBootSplash =
    Platform.OS === "android" || Platform.OS === "ios";

  const { container: splashContainer, logo } = BootSplash.useHideAnimation({
    manifest: require("../assets/bootsplash/manifest.json"),
    logo: require("../assets/bootsplash/logo.png"),
    ready: shouldUseNativeBootSplash ? isReady : false,
    statusBarTranslucent: true,
    navigationBarTranslucent: false,
    animate: () => {
      setVectorAnimationStarted(true);

      Animated.parallel([
        Animated.timing(splashOpacity, {
          useNativeDriver: Platform.OS !== "web",
          toValue: 0,
          duration: 450,
        }),
        Animated.timing(vectorOpacity, {
          useNativeDriver: Platform.OS !== "web",
          toValue: 1,
          duration: 320,
          delay: 120,
        }),
      ]).start(() => {
        setSplashOverlayVisible(false);
      });
    },
  });

  useEffect(() => {
    if (!shouldUseNativeBootSplash && isReady) {
      setVectorAnimationStarted(true);
    }
  }, [isReady, shouldUseNativeBootSplash]);

  useEffect(() => {
    if (vectorAnimationStarted && isReady && svgAnimationFinished && visible) {
      Animated.timing(opacity, {
        useNativeDriver: Platform.OS !== "web",
        toValue: 0,
        duration: 800,
      }).start(() => {
        setVisible(false);
        onAnimationEnd?.();
      });
    }
  }, [
    isReady,
    onAnimationEnd,
    opacity,
    svgAnimationFinished,
    vectorAnimationStarted,
    visible,
  ]);

  return (
    <>
      {children}

      {visible && (
        <Animated.View style={[styles.container, { opacity }]}>
          <Animated.View style={{ opacity: vectorOpacity }}>
            <AnimatedVectorLogo
              shouldAnimate={vectorAnimationStarted}
              onAnimationFinish={() => setSvgAnimationFinished(true)}
            />
          </Animated.View>

          {splashOverlayVisible ? (
            <Animated.View
              {...splashContainer}
              style={[splashContainer.style, { opacity: splashOpacity }]}
            >
              <Image {...logo} fadeDuration={0} />
            </Animated.View>
          ) : null}
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BACKGROUND_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
});
