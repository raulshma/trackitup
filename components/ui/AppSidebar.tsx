import { BlurView } from "expo-blur";
import { Href, usePathname, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Surface, useTheme, type MD3Theme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/Themed";
import { withAlpha } from "@/constants/Colors";
import {
  getShadowStyle,
  uiBorder,
  uiElevation,
  uiMotion,
  uiRadius,
  uiShadow,
  uiSize,
  uiSpace,
  uiTypography,
} from "@/constants/UiTokens";
import {
  useAppSidebarActions,
  useAppSidebarState,
} from "@/providers/AppSidebarProvider";

type SidebarIconName = React.ComponentProps<typeof SymbolView>["name"];

type SidebarRoute = {
  id: string;
  label: string;
  hint: string;
  href: Href;
  icon: SidebarIconName;
  matches: (pathname: string) => boolean;
};

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

const SidebarRouteRow = React.memo(function SidebarRouteRow({
  item,
  isActive,
  onPress,
  primaryContainer,
  onPrimaryContainer,
  onSurface,
  onSurfaceVariant,
  outlineVariant,
  elevationLevel1,
  elevationLevel2,
  primary,
}: {
  item: SidebarRoute;
  isActive: boolean;
  onPress: (item: SidebarRoute) => void;
  primaryContainer: string;
  onPrimaryContainer: string;
  onSurface: string;
  onSurfaceVariant: string;
  outlineVariant: string;
  elevationLevel1: string;
  elevationLevel2: string;
  primary: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open ${item.label}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.routeRow,
        {
          backgroundColor: isActive ? primaryContainer : elevationLevel1,
          borderColor: isActive ? primary : outlineVariant,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.routeIconWrap,
          {
            backgroundColor: isActive ? elevationLevel1 : elevationLevel2,
            borderColor: outlineVariant,
          },
        ]}
      >
        <SymbolView
          name={item.icon}
          size={20}
          tintColor={isActive ? onPrimaryContainer : onSurfaceVariant}
        />
      </View>
      <View style={styles.routeCopy}>
        <Text
          style={[
            styles.routeLabel,
            { color: isActive ? onPrimaryContainer : onSurface },
          ]}
        >
          {item.label}
        </Text>
        <Text
          style={[
            styles.routeHint,
            {
              color: isActive ? onPrimaryContainer : onSurfaceVariant,
            },
          ]}
        >
          {item.hint}
        </Text>
      </View>
    </Pressable>
  );
});

const sidebarGroups: Array<{
  title: string;
  items: SidebarRoute[];
}> = [
  {
    title: "Daily tracking",
    items: [
      {
        id: "home",
        label: "Home",
        hint: "Today’s routine queue and due work overview",
        href: "/",
        icon: { ios: "house.fill", android: "home", web: "home" },
        matches: (pathname) => pathname === "/",
      },
      {
        id: "timeline",
        label: "Timeline",
        hint: "Review recent activity and workspace history",
        href: "/two",
        icon: {
          ios: "list.bullet.rectangle.portrait.fill",
          android: "list",
          web: "list",
        },
        matches: (pathname) => pathname === "/two",
      },
      {
        id: "logbook",
        label: "Logbook",
        hint: "Capture structured updates and event entries",
        href: "/logbook",
        icon: {
          ios: "book.closed.fill",
          android: "menu_book",
          web: "menu_book",
        },
        matches: (pathname) => pathname.startsWith("/logbook"),
      },
      {
        id: "log-calendar",
        label: "Log calendar",
        hint: "Visualize all logs in a high-fidelity monthly timeline",
        href: "/log-calendar",
        icon: {
          ios: "calendar.badge.clock",
          android: "calendar_view_month",
          web: "calendar_view_month",
        },
        matches: (pathname) => pathname.startsWith("/log-calendar"),
      },
      {
        id: "visual-history",
        label: "Visual history",
        hint: "Browse photos and visual changes over time",
        href: "/visual-history",
        icon: {
          ios: "photo.on.rectangle.angled",
          android: "photo_library",
          web: "photo_library",
        },
        matches: (pathname) => pathname.startsWith("/visual-history"),
      },
    ],
  },
  {
    title: "Planning and routines",
    items: [
      {
        id: "planner",
        label: "Planner",
        hint: "Manage reminders, routines, and upcoming work",
        href: "/planner",
        icon: {
          ios: "calendar",
          android: "calendar_month",
          web: "calendar_month",
        },
        matches: (pathname) => pathname === "/planner",
      },
      {
        id: "action-center",
        label: "Action center",
        hint: "Triage due work and follow next suggested actions",
        href: "/action-center",
        icon: {
          ios: "bell.badge.fill",
          android: "notifications",
          web: "notifications",
        },
        matches: (pathname) => pathname.startsWith("/action-center"),
      },
      {
        id: "recurring-plan-editor",
        label: "Recurring plans",
        hint: "Create and adjust recurring schedules",
        href: "/recurring-plan-editor",
        icon: {
          ios: "repeat.circle",
          android: "repeat",
          web: "repeat",
        },
        matches: (pathname) => pathname.startsWith("/recurring-plan-editor"),
      },
      {
        id: "recurring-history",
        label: "Recurring history",
        hint: "Review completed, missed, skipped, and snoozed occurrences",
        href: "/recurring-history",
        icon: {
          ios: "clock.arrow.trianglehead.counterclockwise.rotate.90",
          android: "history",
          web: "history",
        },
        matches: (pathname) => pathname.startsWith("/recurring-history"),
      },
    ],
  },
  {
    title: "Capture and build",
    items: [
      {
        id: "inventory",
        label: "Inventory",
        hint: "Track assets, counts, and related history",
        href: "/inventory",
        icon: {
          ios: "shippingbox.fill",
          android: "inventory_2",
          web: "inventory_2",
        },
        matches: (pathname) => pathname === "/inventory",
      },
      {
        id: "space-create",
        label: "Create space",
        hint: "Set up a new tracked space for this workspace",
        href: "/space-create",
        icon: { ios: "plus.square.fill", android: "add_box", web: "add_box" },
        matches: (pathname) => pathname.startsWith("/space-create"),
      },
      {
        id: "schema-builder",
        label: "Schema builder",
        hint: "Design reusable tracking schemas and forms",
        href: "/schema-builder",
        icon: {
          ios: "square.stack.3d.up.fill",
          android: "schema",
          web: "schema",
        },
        matches: (pathname) => pathname.startsWith("/schema-builder"),
      },
      {
        id: "template-import",
        label: "Template import",
        hint: "Bring in shared TrackItUp templates and forms",
        href: "/template-import",
        icon: {
          ios: "square.and.arrow.down.fill",
          android: "download_for_offline",
          web: "download_for_offline",
        },
        matches: (pathname) => pathname.startsWith("/template-import"),
      },
      {
        id: "scanner",
        label: "Scanner",
        hint: "Scan QR codes and capture device-assisted inputs",
        href: "/scanner",
        icon: {
          ios: "qrcode.viewfinder",
          android: "qr_code_scanner",
          web: "qr_code_scanner",
        },
        matches: (pathname) => pathname.startsWith("/scanner"),
      },
      {
        id: "live-dictation-action",
        label: "Live dictation",
        hint: "Capture and interpret voice-guided entries",
        href: "/live-dictation-action",
        icon: {
          ios: "waveform.badge.mic",
          android: "keyboard_voice",
          web: "keyboard_voice",
        },
        matches: (pathname) => pathname.startsWith("/live-dictation-action"),
      },
    ],
  },
  {
    title: "Workspace admin",
    items: [
      {
        id: "modal",
        label: "Legacy tools route",
        hint: "Compatibility redirect to workspace tools",
        href: "/modal",
        icon: {
          ios: "arrow.triangle.branch",
          android: "alt_route",
          web: "alt_route",
        },
        matches: (pathname) => pathname.startsWith("/modal"),
      },
      {
        id: "workspace-tools",
        label: "Workspace tools",
        hint: "Exports, imports, restore points, and device checks",
        href: "/workspace-tools",
        icon: {
          ios: "checklist",
          android: "task_alt",
          web: "task_alt",
        },
        matches: (pathname) => pathname.startsWith("/workspace-tools"),
      },
      {
        id: "workspace-database",
        label: "Workspace database",
        hint: "Browse and edit persisted spaces in a table view",
        href: "/workspace-database",
        icon: {
          ios: "tablecells",
          android: "table_view",
          web: "table_view",
        },
        matches: (pathname) => pathname.startsWith("/workspace-database"),
      },
      {
        id: "workspace-diagnostics",
        label: "Workspace diagnostics",
        hint: "Run health checks and inspect workspace status",
        href: "/workspace-diagnostics",
        icon: {
          ios: "stethoscope",
          android: "monitor_heart",
          web: "monitor_heart",
        },
        matches: (pathname) => pathname.startsWith("/workspace-diagnostics"),
      },
    ],
  },
  {
    title: "Preferences and models",
    items: [
      {
        id: "account",
        label: "Account",
        hint: "Profile, AI settings, sync, privacy, and security",
        href: "/account",
        icon: {
          ios: "person.crop.circle",
          android: "account_circle",
          web: "account_circle",
        },
        matches: (pathname) => pathname.startsWith("/account"),
      },
      {
        id: "openrouter-model-picker",
        label: "AI model picker",
        hint: "Select and compare OpenRouter models",
        href: "/openrouter-model-picker",
        icon: {
          ios: "brain.head.profile",
          android: "psychology",
          web: "psychology",
        },
        matches: (pathname) => pathname.startsWith("/openrouter-model-picker"),
      },
    ],
  },
];

export function AppSidebar() {
  const isOpen = useAppSidebarState();
  const { closeSidebar, openSidebar } = useAppSidebarActions();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme<MD3Theme>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const progress = React.useRef(new Animated.Value(0)).current;
  const progressValueRef = React.useRef(0);
  const gestureStartValueRef = React.useRef(0);
  const [isVisible, setIsVisible] = React.useState(isOpen);
  const [isDrawerContentReady, setIsDrawerContentReady] =
    React.useState(isOpen);
  const drawerWidth = Math.min(320, Math.max(280, width * 0.84));
  const drawerShadow = React.useMemo(
    () => getShadowStyle(theme.colors.shadow, uiShadow.raisedCard),
    [theme.colors.shadow],
  );
  const shouldRenderBlurBackdrop = Platform.OS === "ios";
  const sectionListSections = React.useMemo(
    () =>
      sidebarGroups.map((group) => ({
        title: group.title,
        data: group.items,
      })),
    [],
  );
  const activeRouteIds = React.useMemo(() => {
    const activeIds = new Set<string>();
    for (const group of sidebarGroups) {
      for (const route of group.items) {
        if (route.matches(pathname)) {
          activeIds.add(route.id);
        }
      }
    }
    return activeIds;
  }, [pathname]);
  const handleRoutePress = React.useCallback(
    (item: SidebarRoute) => {
      closeSidebar();
      router.push(item.href as never);
    },
    [closeSidebar, router],
  );
  const renderSectionHeader = React.useCallback(
    ({ section }: { section: { title: string } }) => (
      <Text
        style={[styles.groupTitle, { color: theme.colors.onSurfaceVariant }]}
      >
        {section.title}
      </Text>
    ),
    [theme.colors.onSurfaceVariant],
  );
  const renderRouteItem = React.useCallback(
    ({ item }: { item: SidebarRoute }) => (
      <SidebarRouteRow
        item={item}
        isActive={activeRouteIds.has(item.id)}
        onPress={handleRoutePress}
        primaryContainer={theme.colors.primaryContainer}
        onPrimaryContainer={theme.colors.onPrimaryContainer}
        onSurface={theme.colors.onSurface}
        onSurfaceVariant={theme.colors.onSurfaceVariant}
        outlineVariant={theme.colors.outlineVariant}
        elevationLevel1={theme.colors.elevation.level1}
        elevationLevel2={theme.colors.elevation.level2}
        primary={theme.colors.primary}
      />
    ),
    [
      activeRouteIds,
      handleRoutePress,
      theme.colors.elevation.level1,
      theme.colors.elevation.level2,
      theme.colors.onPrimaryContainer,
      theme.colors.onSurface,
      theme.colors.onSurfaceVariant,
      theme.colors.outlineVariant,
      theme.colors.primary,
      theme.colors.primaryContainer,
    ],
  );
  const keyExtractor = React.useCallback((item: SidebarRoute) => item.id, []);

  React.useEffect(() => {
    const subscription = progress.addListener(({ value }) => {
      progressValueRef.current = value;
    });

    return () => {
      progress.removeListener(subscription);
    };
  }, [progress]);

  React.useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsDrawerContentReady(false);
      const frameId = requestAnimationFrame(() => {
        setIsDrawerContentReady(true);
      });
      Animated.timing(progress, {
        toValue: 1,
        duration: uiMotion.standard,
        useNativeDriver: true,
      }).start();

      return () => {
        cancelAnimationFrame(frameId);
      };
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: uiMotion.quick,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsVisible(false);
        setIsDrawerContentReady(false);
      }
    });
  }, [isOpen, progress]);

  const drawerAnimatedStyle = React.useMemo(
    () => ({
      transform: [
        {
          translateX: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [-drawerWidth - 24, 0],
          }),
        },
      ],
    }),
    [drawerWidth, progress],
  );

  const backdropAnimatedStyle = React.useMemo(
    () => ({
      opacity: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }),
    }),
    [progress],
  );

  const drawerPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (event, gestureState) => {
          if (Math.abs(gestureState.dx) < 10) return false;
          if (Math.abs(gestureState.dx) < Math.abs(gestureState.dy) * 1.1) {
            return false;
          }

          if (isVisible) {
            return true;
          }

          return event.nativeEvent.pageX <= uiSpace.hero && gestureState.dx > 0;
        },
        onPanResponderGrant: () => {
          if (!isVisible) {
            setIsVisible(true);
          }

          progress.stopAnimation((value) => {
            gestureStartValueRef.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const nextValue = isOpen
            ? Math.min(
                1,
                Math.max(
                  0,
                  gestureStartValueRef.current + gestureState.dx / drawerWidth,
                ),
              )
            : Math.min(1, Math.max(0, gestureState.dx / drawerWidth));
          progress.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          const projectedValue = isOpen
            ? Math.min(
                1,
                Math.max(
                  0,
                  gestureStartValueRef.current + gestureState.dx / drawerWidth,
                ),
              )
            : Math.min(1, Math.max(0, gestureState.dx / drawerWidth));

          if (gestureState.vx > 0.55 || projectedValue > 0.38) {
            openSidebar();
            return;
          }

          closeSidebar();
        },
        onPanResponderTerminate: () => {
          if (progressValueRef.current > 0.5) {
            openSidebar();
          } else {
            closeSidebar();
          }
        },
      }),
    [closeSidebar, drawerWidth, isOpen, isVisible, openSidebar, progress],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {!isVisible ? (
        <View
          style={styles.edgeSwipeArea}
          pointerEvents="auto"
          {...drawerPanResponder.panHandlers}
        />
      ) : null}
      {isVisible ? (
        <>
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
            {shouldRenderBlurBackdrop ? (
              <AnimatedBlurView
                intensity={26}
                tint={theme.dark ? "dark" : "light"}
                style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
              />
            ) : null}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: withAlpha(
                    theme.colors.scrim,
                    shouldRenderBlurBackdrop ? 0.35 : 0.46,
                  ),
                  pointerEvents: "none",
                },
              ]}
            />
            <Pressable
              accessibilityLabel="Close sidebar"
              onPress={closeSidebar}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            {...drawerPanResponder.panHandlers}
            style={[
              styles.drawerWrap,
              drawerAnimatedStyle,
              { paddingTop: insets.top + uiSpace.sm, width: drawerWidth },
            ]}
          >
            <Surface
              style={[
                styles.drawer,
                {
                  backgroundColor: theme.colors.elevation.level1,
                  borderColor: theme.colors.outlineVariant,
                },
                drawerShadow,
              ]}
              elevation={uiElevation.chrome}
            >
              <View style={styles.headerRow}>
                <View style={styles.brandBlock}>
                  <View
                    style={[
                      styles.brandBadge,
                      {
                        backgroundColor: theme.colors.secondaryContainer,
                        borderColor: theme.colors.outlineVariant,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.brandBadgeLabel,
                        { color: theme.colors.onSecondaryContainer },
                      ]}
                    >
                      TIU
                    </Text>
                  </View>
                  <View style={styles.headerCopy}>
                    <Text
                      style={[
                        styles.headerTitle,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      Navigate the workspace
                    </Text>
                    <Text
                      style={[
                        styles.headerSubtitle,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      Jump to any major TrackItUp screen without crowding the
                      dashboard.
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityLabel="Close navigation menu"
                  onPress={closeSidebar}
                  style={({ pressed }) => [
                    styles.closeButton,
                    {
                      backgroundColor: theme.colors.elevation.level2,
                      borderColor: theme.colors.outlineVariant,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <SymbolView
                    name={{ ios: "xmark", android: "close", web: "close" }}
                    size={18}
                    tintColor={theme.colors.onSurfaceVariant}
                  />
                </Pressable>
              </View>

              {isDrawerContentReady ? (
                <SectionList
                  sections={sectionListSections}
                  keyExtractor={keyExtractor}
                  renderSectionHeader={renderSectionHeader}
                  renderItem={renderRouteItem}
                  contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: insets.bottom + uiSpace.surface },
                  ]}
                  stickySectionHeadersEnabled={false}
                  initialNumToRender={10}
                  maxToRenderPerBatch={8}
                  windowSize={7}
                  updateCellsBatchingPeriod={34}
                  showsVerticalScrollIndicator={false}
                  removeClippedSubviews={Platform.OS === "android"}
                />
              ) : (
                <View style={styles.drawerLoadingState}>
                  <Text
                    style={[
                      styles.headerSubtitle,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    Loading navigation…
                  </Text>
                </View>
              )}
            </Surface>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawerWrap: {
    ...StyleSheet.absoluteFillObject,
    left: 0,
    right: undefined,
    paddingLeft: uiSpace.sm,
    paddingBottom: uiSpace.sm,
  },
  edgeSwipeArea: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: uiSpace.hero,
  },
  drawer: {
    flex: 1,
    borderWidth: uiBorder.hairline,
    borderRadius: uiRadius.hero,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: uiSpace.md,
    paddingHorizontal: uiSpace.surface,
    paddingTop: uiSpace.surface,
    paddingBottom: uiSpace.lg,
    borderBottomWidth: uiBorder.hairline,
  },
  brandBlock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: uiSpace.md,
  },
  brandBadge: {
    width: uiSize.headerAction,
    height: uiSize.headerAction,
    borderRadius: uiRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: uiBorder.hairline,
  },
  brandBadgeLabel: {
    ...uiTypography.microLabel,
    fontSize: 10,
  },
  headerCopy: {
    flex: 1,
    gap: uiSpace.xs,
  },
  headerTitle: {
    ...uiTypography.titleSection,
  },
  headerSubtitle: {
    ...uiTypography.bodySmall,
  },
  closeButton: {
    width: uiSize.headerAction,
    height: uiSize.headerAction,
    borderRadius: uiRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: uiBorder.hairline,
  },
  drawerLoadingState: {
    flex: 1,
    paddingHorizontal: uiSpace.surface,
    paddingTop: uiSpace.lg,
  },
  scrollContent: {
    paddingHorizontal: uiSpace.surface,
    paddingTop: uiSpace.lg,
    paddingBottom: uiSpace.xl,
  },
  groupTitle: {
    ...uiTypography.label,
    textTransform: "uppercase",
    marginBottom: uiSpace.sm,
    marginTop: uiSpace.xl,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: uiSpace.lg,
    borderWidth: uiBorder.hairline,
    borderRadius: uiRadius.panel,
    padding: uiSpace.lg,
    marginBottom: uiSpace.sm,
  },
  routeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: uiRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: uiBorder.hairline,
  },
  routeCopy: {
    flex: 1,
    gap: uiSpace.xxs,
  },
  routeLabel: {
    ...uiTypography.bodyStrong,
  },
  routeHint: {
    ...uiTypography.support,
  },
});
