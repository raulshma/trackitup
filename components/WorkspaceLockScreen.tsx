import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Chip, Surface } from "react-native-paper";

import { Text } from "@/components/Themed";
import { ChipRow } from "@/components/ui/ChipRow";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
    uiBorder,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import type { WorkspaceBiometricAvailability } from "@/services/offline/workspaceBiometric";

type WorkspaceLockScreenProps = {
  availability: WorkspaceBiometricAvailability;
  isUnlocking: boolean;
  message: string;
  reauthTimeoutLabel: string;
  onUnlock: () => void;
  onDisableLock: () => void;
};

export function WorkspaceLockScreen({
  availability,
  isUnlocking,
  message,
  reauthTimeoutLabel,
  onDisableLock,
  onUnlock,
}: WorkspaceLockScreenProps) {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const isRecoverable = availability.status !== "available";

  return (
    <View style={[styles.screen, paletteStyles.screenBackground]}>
      <ScreenHero
        palette={palette}
        title="Protected workspace locked"
        subtitle="TrackItUp is waiting for local authentication before it loads this protected workspace scope on the device."
        badges={[
          {
            label: "Protected mode",
            backgroundColor: palette.card,
            textColor: palette.tint,
          },
          {
            label:
              availability.status === "available"
                ? availability.label
                : availability.label,
            backgroundColor: palette.accentSoft,
          },
        ]}
      />

      <SectionSurface
        palette={palette}
        label="Unlock"
        title="Local biometric gate"
      >
        <ChipRow style={styles.chipRow}>
          <Chip compact style={styles.chip} icon="shield-lock">
            Biometric lock enabled
          </Chip>
          <Chip compact style={styles.chip}>
            {availability.label}
          </Chip>
          <Chip compact style={styles.chip}>
            Re-lock: {reauthTimeoutLabel}
          </Chip>
        </ChipRow>
        <Text style={[styles.copy, paletteStyles.mutedText]}>
          {isRecoverable
            ? "Biometric lock is enabled, but this device cannot currently complete biometric verification for the protected workspace."
            : "Unlock with biometrics or the device credential fallback to continue into the protected workspace."}
        </Text>
        <Button
          mode="contained"
          onPress={onUnlock}
          style={styles.button}
          disabled={isUnlocking || isRecoverable}
          loading={isUnlocking}
        >
          Unlock protected workspace
        </Button>
        {isRecoverable ? (
          <Button
            mode="outlined"
            onPress={onDisableLock}
            style={styles.button}
            disabled={isUnlocking}
          >
            Disable biometric lock for this device
          </Button>
        ) : null}
      </SectionSurface>

      <SectionMessage
        palette={palette}
        label="Status"
        title="Biometric lock feedback"
        message={message}
      />

      <Surface
        style={[styles.noteCard, paletteStyles.cardSurface]}
        elevation={1}
      >
        <Text style={styles.noteTitle}>Need a recovery path?</Text>
        <Text style={[styles.noteCopy, paletteStyles.mutedText]}>
          If biometric verification is unavailable, disable biometric lock on
          this device and then re-enable it from Account once local
          authentication is working again.
        </Text>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: uiSpace.screen,
    paddingBottom: uiSpace.screenBottom,
  },
  chipRow: {
    marginTop: uiSpace.lg,
    marginBottom: uiSpace.xs,
  },
  chip: { borderRadius: uiRadius.pill },
  copy: { ...uiTypography.body, marginBottom: uiSpace.xs },
  button: { marginTop: uiSpace.md },
  noteCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    marginTop: uiSpace.lg,
  },
  noteTitle: { ...uiTypography.titleSection, marginBottom: uiSpace.xs },
  noteCopy: { ...uiTypography.body },
});
