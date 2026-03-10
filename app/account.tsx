import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet } from "react-native";
import { ActivityIndicator, Button } from "react-native-paper";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useAppAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";

export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const router = useRouter();
  const auth = useAppAuth();
  const workspace = useWorkspace();
  const [statusMessage, setStatusMessage] = useState(auth.note);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lastLocalSnapshot = new Date(
    workspace.workspace.generatedAt,
  ).toLocaleString();

  async function runAction(
    action: () => Promise<{ status: string; message: string }>,
    options?: { returnToWorkspaceOnSuccess?: boolean },
  ) {
    setIsSubmitting(true);
    const result = await action();
    setStatusMessage(result.message);
    setIsSubmitting(false);

    if (result.status === "success" && options?.returnToWorkspaceOnSuccess) {
      router.replace("/(tabs)");
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    await auth.signOut();
    setStatusMessage(
      "Signed out. Your local workspace is still available on this device.",
    );
    setIsSubmitting(false);
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Account & sync</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Local tracking stays available without login. Sign in only when you
          want cloud-linked features like backups and premium sync.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>Current auth status</Text>
        <Text style={[styles.copy, { color: palette.muted }]}>{auth.note}</Text>
        <Text style={[styles.meta, { color: palette.tint }]}>
          {auth.clerkPublishableKeyConfigured
            ? "Clerk configured"
            : "Clerk key missing"}
        </Text>
      </View>

      {!auth.clerkPublishableKeyConfigured ? (
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={styles.sectionTitle}>Enable sign-in</Text>
          <Text style={[styles.copy, { color: palette.muted }]}>
            Add `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to your Expo environment to
            activate Clerk sign-in. Until then, the app remains fully
            local-first.
          </Text>
          <Button
            mode="contained"
            onPress={() => router.replace("/(tabs)")}
            style={styles.button}
          >
            Continue without login
          </Button>
        </View>
      ) : !auth.isLoaded ? (
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={styles.sectionTitle}>Loading authentication</Text>
          <ActivityIndicator style={styles.loader} />
          <Text style={[styles.copy, { color: palette.muted }]}>
            Clerk is initializing securely on this device.
          </Text>
        </View>
      ) : auth.isSignedIn ? (
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={styles.sectionTitle}>Signed in</Text>
          <Text style={[styles.copy, { color: palette.muted }]}>
            Name: {auth.displayName ?? "Unnamed user"}
          </Text>
          <Text style={[styles.copy, { color: palette.muted }]}>
            Email: {auth.primaryEmailAddress ?? "No primary email returned"}
          </Text>
          <Text style={[styles.copy, { color: palette.muted }]}>
            User ID: {auth.userId ?? "Unavailable"}
          </Text>
          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              onPress={() => router.replace("/(tabs)")}
              style={styles.inlineButton}
            >
              Return to workspace
            </Button>
            <Button
              mode="outlined"
              onPress={handleSignOut}
              style={styles.inlineButton}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Sign out
            </Button>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={styles.sectionTitle}>Optional sign-in</Text>
          <Text style={[styles.copy, { color: palette.muted }]}>
            Use Clerk to connect this device to future premium sync, backups,
            and multi-device access. You can still continue locally without
            signing in.
          </Text>
          <Button
            mode="contained"
            onPress={() =>
              runAction(auth.signInWithGoogle, {
                returnToWorkspaceOnSuccess: true,
              })
            }
            style={styles.button}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Sign in with Google
          </Button>
          {Platform.OS === "ios" ? (
            <Button
              mode="outlined"
              onPress={() =>
                runAction(auth.signInWithApple, {
                  returnToWorkspaceOnSuccess: true,
                })
              }
              style={styles.button}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Sign in with Apple
            </Button>
          ) : null}
          <Button
            mode="text"
            onPress={() => router.replace("/(tabs)")}
            style={styles.button}
          >
            Continue without login
          </Button>
        </View>
      )}

      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>Premium sync status</Text>
        <Text style={[styles.copy, { color: palette.muted }]}>
          Pending queued changes: {workspace.workspace.syncQueue.length}
        </Text>
        <Text style={[styles.copy, { color: palette.muted }]}>
          Local snapshot: {lastLocalSnapshot}
        </Text>
        <Text style={[styles.copy, { color: palette.muted }]}>
          Last sync:{" "}
          {workspace.workspace.lastSyncAt
            ? new Date(workspace.workspace.lastSyncAt).toLocaleString()
            : "No successful sync yet"}
        </Text>
        <Text style={[styles.copy, { color: palette.muted }]}>
          Last error: {workspace.workspace.lastSyncError ?? "None"}
        </Text>
        <Text style={[styles.copy, { color: palette.muted }]}>
          Configure EXPO_PUBLIC_TRACKITUP_SYNC_ENDPOINT to enable push, pull,
          and force-restore cloud backups when Clerk auth is available.
        </Text>
        <Button
          mode="contained"
          onPress={() => runAction(workspace.syncWorkspaceNow)}
          style={styles.button}
          loading={isSubmitting || workspace.isSyncing}
          disabled={isSubmitting || workspace.isSyncing}
        >
          Sync now
        </Button>
        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            onPress={() => runAction(workspace.pullWorkspaceFromCloud)}
            style={styles.inlineButton}
            loading={isSubmitting || workspace.isSyncing}
            disabled={isSubmitting || workspace.isSyncing}
          >
            Pull latest backup
          </Button>
          <Button
            mode="text"
            onPress={() => runAction(workspace.restoreWorkspaceFromCloud)}
            style={styles.inlineButton}
            loading={isSubmitting || workspace.isSyncing}
            disabled={isSubmitting || workspace.isSyncing}
          >
            Force restore
          </Button>
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>Session feedback</Text>
        <Text style={[styles.copy, { color: palette.muted }]}>
          {statusMessage}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  header: { marginBottom: 18 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
  copy: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  meta: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  loader: { marginVertical: 12 },
  button: { marginTop: 10 },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  inlineButton: { flex: 1 },
});
