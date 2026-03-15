import { useRouter } from "expo-router";
import { useMemo, useRef, useState, type ComponentRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Surface,
  TextInput,
  useTheme,
  type MD3Theme,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import {
  uiBorder,
  uiRadius,
  uiSpace,
  uiTypography,
} from "@/constants/UiTokens";
import {
  compactAiTranscriptPreview,
  getAiTranscriptSourceLabel,
} from "@/services/ai/aiTextInput";
import { captureDictationAsync } from "@/services/device/dictation";

export default function LiveDictationActionScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const theme = useTheme<MD3Theme>();
  const transcriptInputRef = useRef<ComponentRef<typeof TextInput> | null>(
    null,
  );
  const transcriptRef = useRef("");
  const dictationAbortControllerRef = useRef<AbortController | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [transcriptPreview, setTranscriptPreview] = useState<string | null>(
    null,
  );
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    "Tap Start listening and speak naturally. You’ll review everything before execution.",
  );

  const canSend = transcript.trim().length > 0;
  const transcriptLengthLabel = useMemo(() => {
    const count = transcript.trim().length;
    return count === 0 ? "Transcript empty" : `${count} chars`;
  }, [transcript]);

  function focusTranscriptInput() {
    requestAnimationFrame(() => {
      transcriptInputRef.current?.focus?.();
    });
  }

  function handleTranscriptChange(nextValue: string) {
    transcriptRef.current = nextValue;
    setTranscript(nextValue);
    const compact = compactAiTranscriptPreview(nextValue);
    setTranscriptPreview(compact || null);
  }

  async function handleStartListening() {
    if (isListening) return;

    const abortController = new AbortController();
    dictationAbortControllerRef.current = abortController;
    setIsListening(true);
    setStatusMessage("Listening now. Tap Stop listening when you’re done.");

    try {
      const result = await captureDictationAsync({
        signal: abortController.signal,
        onTranscript: (nextTranscript) => {
          transcriptRef.current = nextTranscript;
          setTranscript(nextTranscript);
          setTranscriptPreview(compactAiTranscriptPreview(nextTranscript));
          setSourceLabel(getAiTranscriptSourceLabel("speech-recognition"));
        },
      });

      if (result.transcript) {
        transcriptRef.current = result.transcript;
        setTranscript(result.transcript);
        setTranscriptPreview(compactAiTranscriptPreview(result.transcript));
      } else if (result.mode === "device-keyboard") {
        focusTranscriptInput();
      }

      setSourceLabel(getAiTranscriptSourceLabel(result.mode));
      setStatusMessage(result.message);
    } catch {
      setStatusMessage(
        "Live speech capture was unavailable. Try device keyboard dictation, then paste here to continue.",
      );
      focusTranscriptInput();
    } finally {
      dictationAbortControllerRef.current = null;
      setIsListening(false);
    }
  }

  function handleStopListening() {
    if (!isListening) return;

    setStatusMessage("Stopping live capture…");
    dictationAbortControllerRef.current?.abort();
  }

  function handleClear() {
    transcriptRef.current = "";
    setTranscript("");
    setTranscriptPreview(null);
    setSourceLabel(null);
    setStatusMessage("Transcript cleared. Capture again when ready.");
  }

  function openActionCenter(autoGenerate: boolean) {
    const trimmed = transcriptRef.current.trim();
    if (!trimmed) return;

    router.push({
      pathname: "/action-center",
      params: {
        dictatedRequest: trimmed,
        source: "voice-command",
        ...(autoGenerate ? { autoGenerate: "1" } : {}),
      },
    });
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.screenContent}
    >
      <ScreenHero
        palette={palette}
        title="Live dictation"
        subtitle="Speak your intent, review the transcript live, then hand it to Action Center for transparent AI planning and approval."
        badges={[
          {
            label: transcriptLengthLabel,
            backgroundColor: theme.colors.surface,
            textColor: theme.colors.onSurface,
          },
          {
            label: isListening ? "Listening" : "Ready",
            backgroundColor: isListening
              ? theme.colors.primaryContainer
              : theme.colors.secondaryContainer,
            textColor: isListening
              ? theme.colors.onPrimaryContainer
              : theme.colors.onSecondaryContainer,
          },
        ]}
      />

      <SectionSurface
        palette={palette}
        label="Voice capture"
        title="Capture live transcript"
        style={styles.section}
      >
        <View style={styles.chipRow}>
          <Chip compact>{sourceLabel ?? "No source yet"}</Chip>
          <Chip compact>{isListening ? "Mic active" : "Mic idle"}</Chip>
        </View>

        {transcriptPreview ? (
          <Surface
            style={[
              styles.previewCard,
              {
                backgroundColor: theme.colors.elevation.level1,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
            elevation={0}
          >
            <Text
              style={[styles.previewLabel, { color: theme.colors.primary }]}
            >
              Live transcript preview
            </Text>
            <Text
              style={[styles.previewText, { color: theme.colors.onSurface }]}
            >
              {transcriptPreview}
            </Text>
          </Surface>
        ) : (
          <Text style={[styles.meta, { color: palette.muted }]}>
            Start listening to see interim transcription updates in real time.
          </Text>
        )}

        {statusMessage ? (
          <SectionMessage
            palette={palette}
            label="Capture status"
            title="Latest status"
            message={statusMessage}
          />
        ) : null}

        <TextInput
          ref={(instance: ComponentRef<typeof TextInput> | null) => {
            transcriptInputRef.current = instance;
          }}
          mode="outlined"
          label="Transcript"
          value={transcript}
          onChangeText={handleTranscriptChange}
          placeholder="Use keyboard dictation or type your request here..."
          multiline
          numberOfLines={5}
          style={styles.transcriptInput}
        />

        <View style={styles.actionsRow}>
          {isListening ? (
            <Button mode="contained" onPress={handleStopListening}>
              Stop listening
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={() => void handleStartListening()}
            >
              Start listening
            </Button>
          )}
          <Button
            mode="outlined"
            onPress={handleClear}
            disabled={isListening || !canSend}
          >
            Clear
          </Button>
        </View>
      </SectionSurface>

      <SectionSurface
        palette={palette}
        label="Next step"
        title="Send transcript to Action Center"
        style={styles.section}
      >
        <Text style={[styles.meta, { color: palette.muted }]}>
          You’ll still review interpreted intent and exact actions before any
          execution.
        </Text>
        <View style={styles.actionsRow}>
          <Button
            mode="outlined"
            onPress={() => openActionCenter(false)}
            disabled={!canSend || isListening}
          >
            Send to Action Center
          </Button>
          <Button
            mode="contained"
            onPress={() => openActionCenter(true)}
            disabled={!canSend || isListening}
          >
            Send + generate plan
          </Button>
        </View>
      </SectionSurface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenContent: {
    padding: uiSpace.screen,
    paddingBottom: uiSpace.screenBottom,
    gap: uiSpace.lg,
  },
  section: {
    marginBottom: 0,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.sm,
    marginBottom: uiSpace.md,
  },
  previewCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.lg,
    padding: uiSpace.lg,
  },
  previewLabel: {
    ...uiTypography.label,
    marginBottom: uiSpace.xs,
  },
  previewText: uiTypography.body,
  meta: uiTypography.bodySmall,
  transcriptInput: {
    marginTop: uiSpace.lg,
    minHeight: 120,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
    marginTop: uiSpace.lg,
  },
});
