import { getHeaderTitle } from "@react-navigation/elements";
import { Tabs, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { StyleSheet, View } from "react-native";
import { type MD3Theme, useTheme } from "react-native-paper";

import {
    MaterialCompactTopAppBar,
    type MaterialCompactTopAppBarAction,
} from "@/components/ui/MaterialCompactTopAppBar";
import { RecordEventFab } from "@/components/ui/RecordEventFab";
import {
    TabHeaderScrollProvider,
    useTabHeaderScrollValue,
} from "@/components/ui/TabHeaderScrollContext";
import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { useColorScheme } from "@/components/useColorScheme";
import { getAppPalette } from "@/constants/AppTheme";
import {
    uiElevation,
    uiRadius,
    uiShadow,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";

function TabRouteHeader({
  routeName,
  title,
  showBrand,
  actions,
}: {
  routeName: string;
  title: string;
  showBrand: boolean;
  actions?: MaterialCompactTopAppBarAction[];
}) {
  const scrollY = useTabHeaderScrollValue(routeName);

  return (
    <MaterialCompactTopAppBar
      actions={actions}
      canGoBack={false}
      scrollY={scrollY}
      showBrand={showBrand}
      title={title}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const palette = getAppPalette(colorScheme);
  const theme = useTheme<MD3Theme>();
  const router = useRouter();
  const activeTabColor = theme.colors.onSecondaryContainer;
  const inactiveTabColor = theme.colors.onSurfaceVariant;
  const homeHeaderActions = React.useMemo<MaterialCompactTopAppBarAction[]>(
    () => [
      {
        icon: {
          ios: "bell.badge.fill",
          android: "notifications",
          web: "notifications",
        },
        accessibilityLabel: "Open action center",
        onPress: () => router.push("/action-center"),
      },
      {
        icon: {
          ios: "person.crop.circle",
          android: "account_circle",
          web: "account_circle",
        },
        accessibilityLabel: "Open account and sync settings",
        onPress: () => router.push("/account"),
      },
      {
        icon: {
          ios: "checklist",
          android: "task_alt",
          web: "task_alt",
        },
        accessibilityLabel: "Open workspace tools",
        onPress: () => router.push("/workspace-tools"),
      },
    ],
    [router],
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
    <TabHeaderScrollProvider>
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
          headerTransparent: true,
          header: (props) => {
            const showBrand = props.route.name === "index";
            const title = showBrand
              ? "TrackItUp"
              : getHeaderTitle(props.options, props.route.name);

            return (
              <TabRouteHeader
                actions={showBrand ? homeHeaderActions : undefined}
                routeName={props.route.name}
                showBrand={showBrand}
                title={title}
              />
            );
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
            tabBarIcon: renderTabIcon({
              ios: "house.fill",
              android: "home",
              web: "home",
            }),
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
    </TabHeaderScrollProvider>
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
});
