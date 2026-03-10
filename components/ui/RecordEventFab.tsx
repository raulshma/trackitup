import { useMemo } from "react";

import { useRouter } from "expo-router";
import { FAB, Portal, useTheme, type MD3Theme } from "react-native-paper";

import { uiSpace } from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";

export function RecordEventFab() {
  const router = useRouter();
  const theme = useTheme<MD3Theme>();
  const { workspace } = useWorkspace();

  const preferredAction = useMemo(
    () =>
      workspace.quickActions.find((action) => action.kind === "quick-log") ??
      workspace.quickActions[0],
    [workspace.quickActions],
  );

  function handlePress() {
    if (workspace.spaces.length === 0) {
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

  return (
    <Portal>
      <FAB
        icon={workspace.spaces.length === 0 ? "home-plus" : "plus"}
        label={
          workspace.spaces.length === 0
            ? "Create space"
            : (preferredAction?.label ?? "Record")
        }
        accessibilityLabel={
          workspace.spaces.length === 0
            ? "Create your first space"
            : "Record a new event"
        }
        onPress={handlePress}
        style={{
          position: "absolute",
          right: uiSpace.screen,
          bottom: uiSpace.screenBottomTabs - uiSpace.lg,
          backgroundColor: theme.colors.primaryContainer,
        }}
        color={theme.colors.onPrimaryContainer}
      />
    </Portal>
  );
}
