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
    getShadowStyle,
    uiBorder,
    uiElevation,
    uiRadius,
    uiShadow,
    uiSize,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { useAppSidebarActions } from "@/providers/AppSidebarProvider";

function TabRouteHeader({
  routeName,
  title,
  showBrand,
  onOpenSidebar,
  actions,
}: {
  routeName: string;
  title: string;
  showBrand: boolean;
  onOpenSidebar: () => void;
  actions?: MaterialCompactTopAppBarAction[];
}) {
  const scrollY = useTabHeaderScrollValue(routeName);

  return (
    <MaterialCompactTopAppBar
      actions={actions}
      canGoBack={false}
      leadingAction={{
        icon: {
          ios: "sidebar.left",
          android: "menu",
          web: "menu",
        },
        accessibilityLabel: "Open navigation menu",
        onPress: onOpenSidebar,
      }}
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
  const { toggleSidebar } = useAppSidebarActions();
  const activeTabColor = theme.colors.onPrimaryContainer;
  const inactiveTabColor = theme.colors.onSurfaceVariant;
  const tabBarShadow = React.useMemo(
    () => getShadowStyle(palette.shadow, uiShadow.tabBar),
    [palette.shadow],
  );
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
              backgroundColor: theme.colors.primaryContainer,
              borderColor: theme.colors.outlineVariant,
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
    [
      activeTabColor,
      theme.colors.outlineVariant,
      theme.colors.primaryContainer,
    ],
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
            backgroundColor: theme.colors.elevation.level1,
            borderTopWidth: uiBorder.hairline,
            borderTopColor: theme.colors.outlineVariant,
            height: uiSize.tabBarHeight,
            paddingTop: uiSpace.sm,
            paddingBottom: uiSpace.sm,
            paddingHorizontal: uiSpace.sm,
            ...tabBarShadow,
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
                onOpenSidebar={toggleSidebar}
                routeName={props.route.name}
                showBrand={showBrand}
                title={title}
              />
            );
          },
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
    width: uiSize.tabBarActiveIndicatorWidth,
    height: 32,
    borderRadius: uiRadius.pill,
    borderWidth: uiBorder.hairline,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
});
