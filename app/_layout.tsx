import { getHeaderTitle } from "@react-navigation/elements";
import { ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  useColorScheme as useNativeColorScheme,
  View,
} from "react-native";
import BootSplash from "react-native-bootsplash";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";

import { OnboardingExperience } from "@/components/OnboardingExperience";
import { AppSidebar } from "@/components/ui/AppSidebar";
import { MaterialCompactTopAppBar } from "@/components/ui/MaterialCompactTopAppBar";
import { useColorScheme } from "@/components/useColorScheme";
import { getAppThemes, isDarkColorScheme } from "@/constants/AppTheme";
import { uiSpace, uiTypography } from "@/constants/UiTokens";
import { AiPreferencesProvider } from "@/providers/AiPreferencesProvider";
import {
  AppSidebarProvider,
  useAppSidebarActions,
} from "@/providers/AppSidebarProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import {
  OnboardingProvider,
  useOnboarding,
} from "@/providers/OnboardingProvider";
import { ThemePreferenceProvider } from "@/providers/ThemePreferenceProvider";
import { WorkspacePrivacyModeProvider } from "@/providers/WorkspacePrivacyModeProvider";
import { WorkspaceProvider } from "@/providers/WorkspaceProvider";
import { getReminderNotificationResponseIntent } from "@/services/reminders/reminderNotificationIntents";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/workspace-tools` keeps a back button present.
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const systemColorScheme = useNativeColorScheme();
  const startupColorScheme = systemColorScheme === "light" ? "light" : "dark";
  const { paperTheme } = getAppThemes(startupColorScheme);
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) {
    return (
      <StartupLoadingScreen
        accentColor={paperTheme.colors.primary}
        backgroundColor={paperTheme.colors.background}
        message="Warming up your workspace experience."
        textColor={paperTheme.colors.onBackground}
        title="Loading TrackItUp"
      />
    );
  }

  return (
    <ThemePreferenceProvider>
      <AiPreferencesProvider>
        <OnboardingProvider>
          <RootLayoutNav />
        </OnboardingProvider>
      </AiPreferencesProvider>
    </ThemePreferenceProvider>
  );
}

function useNotificationObserver() {
  const handledResponseRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;

    function maybeRedirect(response: Notifications.NotificationResponse) {
      const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handledResponseRef.current === key) return;

      const intent = getReminderNotificationResponseIntent(response);
      if (!intent || intent.kind !== "default") return;

      handledResponseRef.current = key;
      const route = intent.route;

      if (route === "action-center") {
        router.push("/action-center");
      }

      void Notifications.clearLastNotificationResponseAsync();
    }

    const response = Notifications.getLastNotificationResponse();
    if (response) {
      maybeRedirect(response);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (nextResponse) => {
        maybeRedirect(nextResponse);
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);
}

function RootLayoutNav() {
  const hasHiddenSplashRef = useRef(false);
  const colorScheme = useColorScheme();
  const { navigationTheme, paperTheme, palette } = getAppThemes(colorScheme);
  const statusBarStyle = isDarkColorScheme(colorScheme) ? "light" : "dark";
  const {
    hasCompletedOnboarding,
    isLoaded: isOnboardingLoaded,
    setHasCompletedOnboardingPreference,
  } = useOnboarding();

  useNotificationObserver();

  useEffect(() => {
    if (
      Platform.OS === "web" ||
      !isOnboardingLoaded ||
      hasHiddenSplashRef.current
    ) {
      return;
    }

    hasHiddenSplashRef.current = true;

    void new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    })
      .then(() => BootSplash.hide({ fade: false }))
      .catch(() => {
        // no-op: avoid startup lock if hide rejects
      });
  }, [isOnboardingLoaded]);

  return (
    <AuthProvider>
      <WorkspacePrivacyModeProvider>
        <PaperProvider theme={paperTheme}>
          <StatusBar style={statusBarStyle} />
          <ThemeProvider value={navigationTheme}>
            {!isOnboardingLoaded ? (
              <StartupLoadingScreen
                accentColor={paperTheme.colors.primary}
                backgroundColor={paperTheme.colors.background}
                message="Loading preferences and restoring your latest workspace."
                textColor={paperTheme.colors.onBackground}
                title="Preparing your workspace"
              />
            ) : !hasCompletedOnboarding ? (
              <OnboardingExperience
                onComplete={() => setHasCompletedOnboardingPreference(true)}
              />
            ) : (
              <WorkspaceProvider>
                <AppSidebarProvider>
                  <WorkspaceNavigator palette={palette.background} />
                  <AppSidebar />
                </AppSidebarProvider>
              </WorkspaceProvider>
            )}
          </ThemeProvider>
        </PaperProvider>
      </WorkspacePrivacyModeProvider>
    </AuthProvider>
  );
}

function StartupLoadingScreen({
  backgroundColor,
  textColor,
  accentColor,
  title,
  message,
}: {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  title: string;
  message: string;
}) {
  return (
    <View style={[styles.loadingScreen, { backgroundColor }]}>
      <ActivityIndicator
        size="large"
        color={accentColor}
        style={styles.loadingSpinner}
      />
      <Text style={[styles.loadingTitle, { color: textColor }]}>{title}</Text>
      <Text style={[styles.loadingCopy, { color: textColor }]}>{message}</Text>
    </View>
  );
}

function WorkspaceNavigator({ palette }: { palette: string }) {
  const { toggleSidebar } = useAppSidebarActions();

  return (
    <Stack
      screenOptions={{
        animation:
          Platform.OS === "android"
            ? "fade_from_bottom"
            : Platform.OS === "ios"
              ? "default"
              : "fade",
        animationMatchesGesture: true,
        contentStyle: { backgroundColor: palette },
        fullScreenGestureEnabled: Platform.OS === "ios",
        gestureEnabled: true,
        header: (props) => (
          <MaterialCompactTopAppBar
            canGoBack={Boolean(props.back)}
            onBack={props.navigation.goBack}
            actions={[
              {
                icon: {
                  ios: "sidebar.left",
                  android: "menu",
                  web: "menu",
                },
                accessibilityLabel: "Open navigation menu",
                onPress: toggleSidebar,
              },
            ]}
            title={getHeaderTitle(props.options, props.route.name)}
          />
        ),
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="account" options={{ title: "Account" }} />
      <Stack.Screen name="logbook" options={{ title: "Logbook" }} />
      <Stack.Screen name="log-calendar" options={{ title: "Log calendar" }} />
      <Stack.Screen name="space-create" options={{ title: "Create space" }} />
      <Stack.Screen name="action-center" options={{ title: "Action center" }} />
      <Stack.Screen
        name="visual-history"
        options={{ title: "Visual history" }}
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
        name="workspace-tools"
        options={{ title: "Workspace tools" }}
      />
      <Stack.Screen
        name="workspace-database"
        options={{ title: "Workspace database" }}
      />
      <Stack.Screen
        name="workspace-diagnostics"
        options={{ title: "Workspace diagnostics" }}
      />
      <Stack.Screen
        name="openrouter-model-picker"
        options={{
          animation:
            Platform.OS === "android"
              ? "fade_from_bottom"
              : "slide_from_bottom",
          title: "OpenRouter models",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="live-dictation-action"
        options={{
          animation:
            Platform.OS === "android"
              ? "fade_from_bottom"
              : "slide_from_bottom",
          title: "Live voice command",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="modal"
        options={{ animation: "fade_from_bottom", headerShown: false }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: uiSpace.screen,
  },
  loadingSpinner: {
    marginBottom: uiSpace.surface,
  },
  loadingTitle: {
    ...uiTypography.titleXl,
    marginBottom: uiSpace.sm,
  },
  loadingCopy: {
    ...uiTypography.body,
    textAlign: "center",
  },
});
