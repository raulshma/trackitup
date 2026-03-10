import { getHeaderTitle } from "@react-navigation/elements";
import { ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";

import { AnimatedSplashScreen } from "@/components/AnimatedSplashScreen";
import { OnboardingExperience } from "@/components/OnboardingExperience";
import { MaterialCompactTopAppBar } from "@/components/ui/MaterialCompactTopAppBar";
import { useColorScheme } from "@/components/useColorScheme";
import { getAppThemes, isDarkColorScheme } from "@/constants/AppTheme";
import { uiSpace, uiTypography } from "@/constants/UiTokens";
import { AuthProvider } from "@/providers/AuthProvider";
import {
    OnboardingProvider,
    useOnboarding,
} from "@/providers/OnboardingProvider";
import { ThemePreferenceProvider } from "@/providers/ThemePreferenceProvider";
import { WorkspacePrivacyModeProvider } from "@/providers/WorkspacePrivacyModeProvider";
import { WorkspaceProvider } from "@/providers/WorkspaceProvider";

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// The splash screen from BootSplash will remain until BootSplash.hide() is called
// inside AnimatedSplashScreen when the app is fully ready.

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemePreferenceProvider>
      <OnboardingProvider>
        <WorkspacePrivacyModeProvider>
          <RootLayoutNav />
        </WorkspacePrivacyModeProvider>
      </OnboardingProvider>
    </ThemePreferenceProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { navigationTheme, paperTheme, palette } = getAppThemes(colorScheme);
  const statusBarStyle = isDarkColorScheme(colorScheme) ? "light" : "dark";
  const {
    hasCompletedOnboarding,
    isLoaded: isOnboardingLoaded,
    setHasCompletedOnboardingPreference,
  } = useOnboarding();

  return (
    <AnimatedSplashScreen isReady={isOnboardingLoaded}>
      <AuthProvider>
        <PaperProvider theme={paperTheme}>
          <StatusBar style={statusBarStyle} />
          <ThemeProvider value={navigationTheme}>
            {!isOnboardingLoaded ? null : !hasCompletedOnboarding ? (
              <OnboardingExperience
                onComplete={() => setHasCompletedOnboardingPreference(true)}
              />
            ) : (
              <WorkspaceProvider>
                <Stack
                  screenOptions={{
                    contentStyle: { backgroundColor: palette.background },
                    header: (props) => (
                      <MaterialCompactTopAppBar
                        canGoBack={Boolean(props.back)}
                        onBack={props.navigation.goBack}
                        title={getHeaderTitle(props.options, props.route.name)}
                      />
                    ),
                  }}
                >
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen name="account" options={{ title: "Account" }} />
                  <Stack.Screen name="logbook" options={{ title: "Logbook" }} />
                  <Stack.Screen
                    name="space-create"
                    options={{ title: "Create space" }}
                  />
                  <Stack.Screen
                    name="schema-builder"
                    options={{ title: "Schema builder" }}
                  />
                  <Stack.Screen name="scanner" options={{ title: "Scanner" }} />
                  <Stack.Screen
                    name="template-import"
                    options={{ title: "Template import" }}
                  />
                  <Stack.Screen
                    name="modal"
                    options={{ presentation: "modal" }}
                  />
                </Stack>
              </WorkspaceProvider>
            )}
          </ThemeProvider>
        </PaperProvider>
      </AuthProvider>
    </AnimatedSplashScreen>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: uiSpace.screen,
  },
  loadingTitle: {
    ...uiTypography.titleXl,
    marginTop: uiSpace.surface,
    marginBottom: uiSpace.sm,
  },
  loadingCopy: {
    ...uiTypography.body,
    textAlign: "center",
  },
});
