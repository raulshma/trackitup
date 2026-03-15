import type { ExpoConfig } from "expo/config";

const BASE_ANDROID_PACKAGE = "com.keepaside.trackitup";
const DEVELOPMENT_ANDROID_PACKAGE = `${BASE_ANDROID_PACKAGE}.dev`;

type AppVariant = "development" | "production";

function resolveAppVariant(rawVariant: string | undefined): AppVariant {
  if (!rawVariant || rawVariant.trim().length === 0) {
    return "development";
  }

  const normalizedVariant = rawVariant.trim().toLowerCase();
  if (
    normalizedVariant === "development" ||
    normalizedVariant === "production"
  ) {
    return normalizedVariant;
  }

  throw new Error(
    `[app.config] Invalid APP_VARIANT=\"${rawVariant}\". Expected \"development\" or \"production\".`,
  );
}

const appVariant = resolveAppVariant(process.env.APP_VARIANT);
const androidPackage =
  appVariant === "production"
    ? BASE_ANDROID_PACKAGE
    : DEVELOPMENT_ANDROID_PACKAGE;

const config: ExpoConfig = {
  name: "trackitup",
  slug: "trackitup",
  version: "0.0.5",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "trackitup",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/bootsplash/logo.png",
    resizeMode: "contain",
    backgroundColor: "#0F172A",
  },
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0F172A",
      foregroundImage: "./assets/images/android-icon-foreground.png",
    },
    allowBackup: false,
    predictiveBackGestureEnabled: false,
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
    ],
    blockedPermissions: [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
    package: androidPackage,
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "./plugins/withTrackItUpAndroidAbiSplits.js",
    [
      "expo-local-authentication",
      {
        faceIDPermission:
          "Allow TrackItUp to use Face ID to unlock your protected local workspace.",
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "Allow TrackItUp to capture photos and scans for logs, inventory, and templates.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Allow TrackItUp to attach locations to logs, finds, and tracked assets.",
      },
    ],
    "./plugins/withTrackItUpAndroidSplashTheme.js",
    [
      "./plugins/withTrackItUpBootSplash.js",
      {
        assetsOutput: "assets/bootsplash",
        logo: "./assets/bootsplash/logo.png",
        logoWidth: 96,
        background: "#0F172A",
      },
    ],
    "expo-speech-recognition",
  ],
  experiments: {
    reactCompiler: true,
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "d27723a5-2a24-4ece-a8e9-8666d065c7b1",
    },
  },
};

export default config;
