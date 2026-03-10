import { Link, Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { type MD3Theme, useTheme } from "react-native-paper";

import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { useColorScheme } from "@/components/useColorScheme";
import { getAppPalette } from "@/constants/AppTheme";
import {
    uiBorder,
    uiElevation,
    uiRadius,
    uiShadow,
    uiSize,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const palette = getAppPalette(colorScheme);
  const theme = useTheme<MD3Theme>();
  const headerActionToneStyles = React.useMemo(
    () =>
      StyleSheet.create({
        surface: {
          backgroundColor: theme.colors.elevation.level2,
          borderColor: theme.colors.outlineVariant,
          shadowColor: palette.shadow,
        },
        pressed: {
          opacity: 0.72,
        },
        idle: {
          opacity: 1,
        },
      }),
    [
      palette.shadow,
      theme.colors.elevation.level2,
      theme.colors.outlineVariant,
    ],
  );

  return (
    <Tabs
      screenOptions={{
        sceneStyle: {
          backgroundColor: theme.colors.background,
        },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: palette.tabIconDefault,
        tabBarActiveBackgroundColor: palette.primaryContainer,
        tabBarStyle: {
          backgroundColor: theme.colors.elevation.level2,
          borderTopColor: theme.colors.outlineVariant,
          borderTopWidth: uiBorder.hairline,
          height: uiSize.tabBarHeight,
          paddingTop: uiSpace.md,
          paddingBottom: uiSpace.lg,
          paddingHorizontal: uiSpace.sm,
          shadowColor: palette.shadow,
          ...uiShadow.tabBar,
          elevation: uiElevation.chrome,
        },
        tabBarItemStyle: {
          borderRadius: uiRadius.lg,
          marginHorizontal: uiSpace.xs,
          marginVertical: uiSpace.xxs,
        },
        tabBarLabelStyle: {
          ...uiTypography.tabLabel,
          marginTop: 1,
        },
        headerStyle: {
          backgroundColor: theme.colors.elevation.level2,
        },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        headerTitleAlign: "left",
        headerTitleStyle: uiTypography.navTitle,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerTitle: "TrackItUp",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "house.fill",
                android: "home",
                web: "home",
              }}
              tintColor={color}
              size={28}
            />
          ),
          headerRight: () => (
            <View style={styles.headerActions}>
              <Link href="../account" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.headerActionButton,
                        headerActionToneStyles.surface,
                        pressed
                          ? headerActionToneStyles.pressed
                          : headerActionToneStyles.idle,
                      ]}
                    >
                      <SymbolView
                        name={{
                          ios: "person.crop.circle",
                          android: "account_circle",
                          web: "account_circle",
                        }}
                        size={22}
                        tintColor={palette.text}
                      />
                    </View>
                  )}
                </Pressable>
              </Link>
              <Link href="/modal" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.headerActionButton,
                        headerActionToneStyles.surface,
                        pressed
                          ? headerActionToneStyles.pressed
                          : headerActionToneStyles.idle,
                      ]}
                    >
                      <SymbolView
                        name={{
                          ios: "checklist",
                          android: "task_alt",
                          web: "task_alt",
                        }}
                        size={22}
                        tintColor={palette.text}
                      />
                    </View>
                  )}
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: "Timeline",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "list.bullet.rectangle.portrait.fill",
                android: "list",
                web: "list",
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: "Planner",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "calendar",
                android: "calendar_month",
                web: "calendar_month",
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "shippingbox.fill",
                android: "inventory_2",
                web: "inventory_2",
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerActionButton: {
    width: uiSize.headerAction,
    height: uiSize.headerAction,
    borderRadius: uiRadius.lg,
    borderWidth: uiBorder.standard,
    alignItems: "center",
    justifyContent: "center",
    ...uiShadow.headerAction,
    elevation: uiElevation.hero,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiSpace.xxl,
    marginRight: uiSpace.xl,
  },
});
