import { ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";

import { useColorScheme } from "@/components/useColorScheme";
import { getAppThemes, isDarkColorScheme } from "@/constants/AppTheme";
import { uiTypography } from "@/constants/UiTokens";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemePreferenceProvider } from "@/providers/ThemePreferenceProvider";
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

  return (
    <ThemePreferenceProvider>
      <RootLayoutNav />
    </ThemePreferenceProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { navigationTheme, paperTheme, palette } = getAppThemes(colorScheme);
  const statusBarStyle = isDarkColorScheme(colorScheme) ? "light" : "dark";

  return (
    <AuthProvider>
      <PaperProvider theme={paperTheme}>
        <StatusBar style={statusBarStyle} />
        <WorkspaceProvider>
          <ThemeProvider value={navigationTheme}>
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: palette.background },
                headerStyle: {
                  backgroundColor: paperTheme.colors.elevation.level2,
                },
                headerTintColor: paperTheme.colors.onSurface,
                headerShadowVisible: false,
                headerTitleAlign: "left",
                headerTitleStyle: uiTypography.navTitle,
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
