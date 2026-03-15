import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { usePathname, useRouter } from "expo-router";
import { FAB, Portal, useTheme, type MD3Theme } from "react-native-paper";

import { withAlpha } from "@/constants/Colors";
import {
  getShadowStyle,
  uiBorder,
  uiElevation,
  uiRadius,
  uiShadow,
  uiSpace,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";

const visibleFabPathnames = new Set(["/", "/two", "/planner", "/inventory"]);

type FabMenuAction = {
  icon: string;
  label: string;
  accessibilityLabel: string;
  tone: "default" | "primary";
  onPress: () => void;
};

export function RecordEventFab() {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme<MD3Theme>();
  const { isWorkspaceLocked, workspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const hasSpaces = workspace.spaces.length > 0;

  const preferredAction = useMemo(
    () =>
      workspace.quickActions.find((action) => action.kind === "quick-log") ??
      workspace.quickActions[0],
    [workspace.quickActions],
  );

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  if (!visibleFabPathnames.has(pathname) || isWorkspaceLocked) {
    return null;
  }

  function handleOpenRecord() {
    setIsOpen(false);

    if (!hasSpaces) {
      router.push({
        pathname: "/space-create",
        params: preferredAction ? { actionId: preferredAction.id } : undefined,
      });
      return;
    }

    if (!preferredAction) {
      router.push("/logbook");
      return;
    }

    router.push({
      pathname: "/logbook",
      params: { actionId: preferredAction.id },
    });
  }

  function handleCreateSpace() {
    setIsOpen(false);
    router.push({
      pathname: "/space-create",
      params: preferredAction ? { actionId: preferredAction.id } : undefined,
    });
  }

  function handleLiveDictation() {
    setIsOpen(false);
    router.push("/live-dictation-action");
  }

  const actions: FabMenuAction[] = hasSpaces
    ? [
        {
          icon: "plus",
          label: preferredAction?.label ?? "Record event",
          accessibilityLabel: "Record a new event",
          tone: "default",
          onPress: handleOpenRecord,
        },
        {
          icon: "microphone",
          label: "Live dictation",
          accessibilityLabel: "Start live dictation",
          tone: "primary",
          onPress: handleLiveDictation,
        },
        {
          icon: "home-plus",
          label: "Create space",
          accessibilityLabel: "Create a space",
          tone: "default",
          onPress: handleCreateSpace,
        },
      ]
    : [
        {
          icon: "home-plus",
          label: "Create first space",
          accessibilityLabel: "Create your first space",
          tone: "primary",
          onPress: handleCreateSpace,
        },
        {
          icon: "microphone",
          label: "Set up voice control",
          accessibilityLabel: "Create a space to enable live dictation",
          tone: "default",
          onPress: handleLiveDictation,
        },
      ];

  const scrimStyle = {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(theme.colors.onSurface, 0.08),
  };

  return (
    <Portal>
      {isOpen ? (
        <Pressable
          accessibilityLabel="Close action menu"
          onPress={() => setIsOpen(false)}
          style={scrimStyle}
        />
      ) : null}

      <View
        style={{
          position: "absolute",
          right: uiSpace.screen,
          bottom: uiSpace.screenBottomTabs - uiSpace.xl,
          alignItems: "flex-end",
          gap: uiSpace.sm,
        }}
      >
        {isOpen
          ? actions.map((action) => (
              <FAB
                key={action.label}
                icon={action.icon}
                label={action.label}
                accessibilityLabel={action.accessibilityLabel}
                onPress={action.onPress}
                size="small"
                style={[
                  styles.secondaryFab,
                  {
                    backgroundColor:
                      action.tone === "primary"
                        ? theme.colors.secondaryContainer
                        : theme.colors.elevation.level2,
                    borderColor:
                      action.tone === "primary"
                        ? theme.colors.secondary
                        : theme.colors.outlineVariant,
                  },
                ]}
                color={
                  action.tone === "primary"
                    ? theme.colors.onSecondaryContainer
                    : theme.colors.onSurface
                }
                customSize={42}
              />
            ))
          : null}

        <FAB
          icon={isOpen ? "close" : !hasSpaces ? "home-plus" : "plus"}
          label={isOpen ? "Close" : hasSpaces ? "Actions" : "Get started"}
          accessibilityLabel={
            isOpen
              ? "Close action menu"
              : !hasSpaces
                ? "Open create space and action menu"
                : "Open record action menu"
          }
          onPress={() => setIsOpen((current) => !current)}
          style={{
            backgroundColor: theme.colors.primaryContainer,
            ...getShadowStyle(theme.colors.shadow, uiShadow.raisedCard),
            elevation: uiElevation.chrome,
          }}
          color={theme.colors.onPrimaryContainer}
        />
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  secondaryFab: {
    borderWidth: uiBorder.hairline,
    borderRadius: uiRadius.pill,
  },
});
