import { Link, Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { type MD3Theme, useTheme } from "react-native-paper";

import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { useColorScheme } from "@/components/useColorScheme";
import { getAppPalette } from "@/constants/AppTheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const palette = getAppPalette(colorScheme);
  const theme = useTheme<MD3Theme>();

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
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 72,
          paddingTop: 10,
          paddingBottom: 12,
          paddingHorizontal: 8,
          shadowColor: palette.shadow,
          shadowOpacity: 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          elevation: 8,
        },
        tabBarItemStyle: {
          borderRadius: 20,
          marginHorizontal: 4,
          marginVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 1,
        },
        headerStyle: {
          backgroundColor: theme.colors.elevation.level2,
        },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        headerTitleAlign: "left",
        headerTitleStyle: {
          fontSize: 22,
          fontWeight: "600",
        },
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                marginRight: 15,
              }}
            >
              <Link href="../account" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.headerActionButton,
                        {
                          backgroundColor: theme.colors.elevation.level2,
                          borderColor: theme.colors.outlineVariant,
                          shadowColor: palette.shadow,
                          opacity: pressed ? 0.72 : 1,
                        },
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
                        {
                          backgroundColor: theme.colors.elevation.level2,
                          borderColor: theme.colors.outlineVariant,
                          shadowColor: palette.shadow,
                          opacity: pressed ? 0.72 : 1,
                        },
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
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
});
