import { Link, Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { type MD3Theme, useTheme } from "react-native-paper";

import { RecordEventFab } from "@/components/ui/RecordEventFab";
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
  const activeTabColor = theme.colors.onSecondaryContainer;
  const inactiveTabColor = theme.colors.onSurfaceVariant;
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

  const renderTabIcon = React.useCallback(
    (name: React.ComponentProps<typeof SymbolView>["name"]) =>
      ({ color, focused }: { color: string; focused: boolean }) => (
        <View
          style={[
            styles.tabIconContainer,
            focused && {
              backgroundColor: theme.colors.secondaryContainer,
            },
          ]}
        >
          <SymbolView
            name={name}
            tintColor={focused ? activeTabColor : color}
            size={24}
          />
        </View>
      ),
    [activeTabColor, theme.colors.secondaryContainer],
  );

  return (
    <>
      <Tabs
        screenOptions={{
          sceneStyle: {
            backgroundColor: theme.colors.background,
          },
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: activeTabColor,
          tabBarInactiveTintColor: inactiveTabColor,
          tabBarActiveBackgroundColor: "transparent",
          tabBarInactiveBackgroundColor: "transparent",
          tabBarLabelPosition: "below-icon",
          tabBarStyle: {
            backgroundColor: theme.colors.elevation.level2,
            borderTopColor: "transparent",
            borderTopWidth: 0,
            height: 80,
            paddingTop: uiSpace.sm,
            paddingBottom: uiSpace.sm,
            paddingHorizontal: uiSpace.sm,
            shadowColor: palette.shadow,
            ...uiShadow.tabBar,
            elevation: uiElevation.chrome,
          },
          tabBarItemStyle: {
            justifyContent: "center",
            paddingVertical: uiSpace.xxs,
          },
          tabBarIconStyle: {
            marginBottom: 0,
          },
          tabBarLabelStyle: {
            ...uiTypography.tabLabel,
            fontSize: 12,
            fontWeight: "500",
            marginTop: uiSpace.xxs,
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
            tabBarIcon: renderTabIcon({
              ios: "house.fill",
              android: "home",
              web: "home",
            }),
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
            tabBarIcon: renderTabIcon({
              ios: "list.bullet.rectangle.portrait.fill",
              android: "list",
              web: "list",
            }),
          }}
        />
        <Tabs.Screen
          name="planner"
          options={{
            title: "Planner",
            tabBarIcon: renderTabIcon({
              ios: "calendar",
              android: "calendar_month",
              web: "calendar_month",
            }),
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: "Inventory",
            tabBarIcon: renderTabIcon({
              ios: "shippingbox.fill",
              android: "inventory_2",
              web: "inventory_2",
            }),
          }}
        />
      </Tabs>
      <RecordEventFab />
    </>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    width: 64,
    height: 32,
    borderRadius: uiRadius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
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
