import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import "react-native-reanimated";

import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { AuthProvider } from "@/providers/AuthProvider";
import { WorkspaceProvider } from "@/providers/WorkspaceProvider";

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const navigationBaseTheme = colorScheme === "dark" ? DarkTheme : DefaultTheme;
  const paperBaseTheme = colorScheme === "dark" ? MD3DarkTheme : MD3LightTheme;
  const navigationTheme = {
    ...navigationBaseTheme,
    colors: {
      ...navigationBaseTheme.colors,
      primary: palette.tint,
      background: palette.background,
      card: palette.card,
      text: palette.text,
      border: palette.border,
      notification: palette.tint,
    },
  };
  const paperTheme = {
    ...paperBaseTheme,
    roundness: 6,
    colors: {
      ...paperBaseTheme.colors,
      primary: palette.tint,
      secondary: palette.tint,
      background: palette.background,
      surface: palette.card,
      surfaceVariant: palette.cardAlt,
      outline: palette.border,
      outlineVariant: palette.border,
      onSurface: palette.text,
      onSurfaceVariant: palette.muted,
      elevation: {
        ...paperBaseTheme.colors.elevation,
        level1: palette.cardAlt,
        level2: palette.hero,
        level3: palette.card,
      },
    },
  };

  return (
    <AuthProvider>
      <PaperProvider theme={paperTheme}>
        <WorkspaceProvider>
          <ThemeProvider value={navigationTheme}>
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: palette.background },
                headerStyle: { backgroundColor: palette.background },
                headerTintColor: palette.text,
                headerShadowVisible: false,
                headerTitleStyle: {
                  fontSize: 18,
                  fontWeight: "700",
                },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="account" options={{ title: "Account" }} />
              <Stack.Screen name="logbook" options={{ title: "Logbook" }} />
              <Stack.Screen
                name="schema-builder"
                options={{ title: "Schema builder" }}
              />
              <Stack.Screen name="scanner" options={{ title: "Scanner" }} />
              <Stack.Screen
                name="template-import"
                options={{ title: "Template import" }}
              />
              <Stack.Screen name="modal" options={{ presentation: "modal" }} />
            </Stack>
          </ThemeProvider>
        </WorkspaceProvider>
      </PaperProvider>
    </AuthProvider>
  );
}
