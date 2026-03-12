import { useRef, useState, type ComponentRef } from "react";
import { StyleSheet } from "react-native";
import {
    Button,
    Chip,
    Surface,
    TextInput,
    useTheme,
    type MD3Theme,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import {
    uiBorder,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import {
    canSubmitAiPrompt,
    compactAiTranscriptPreview,
    getAiPromptCharacterCountLabel,
    getAiTranscriptSourceLabel,
} from "@/services/ai/aiTextInput";
import {
    appendDictationTranscript,
    captureDictationAsync,
} from "@/services/device/dictation";

import { ActionButtonRow } from "./ActionButtonRow";
import { ChipRow } from "./ChipRow";
import { SectionSurface } from "./SectionSurface";

type AiPromptComposerCardProps = {
  palette: AppPalette;
  title: string;
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  label?: string;
  contextChips?: string[];
  placeholder?: string;
  helperText?: string;
  consentLabel?: string;
  footerNote?: string;
  submitLabel?: string;
  clearLabel?: string;
  dictateLabel?: string;
  transcriptTitle?: string;
  isBusy?: boolean;
  readOnly?: boolean;
  submitDisabled?: boolean;
  dictateDisabled?: boolean;
  clearDisabled?: boolean;
};

export function AiPromptComposerCard({
  palette,
  title,
  value,
  onChangeText,
  onSubmit,
  label = "AI input",
  contextChips = [],
  placeholder = "Describe what you want TrackItUp to draft...",
  helperText,
  consentLabel,
  footerNote,
  submitLabel = "Generate draft",
  clearLabel = "Clear",
  dictateLabel = "Dictate",
  transcriptTitle = "Transcript preview",
  isBusy = false,
  readOnly = false,
  submitDisabled = false,
  dictateDisabled = false,
  clearDisabled = false,
}: AiPromptComposerCardProps) {
  const theme = useTheme<MD3Theme>();
  const textInputRef = useRef<ComponentRef<typeof TextInput> | null>(null);
  const latestValueRef = useRef(value);
  latestValueRef.current = value;
  const [isCapturing, setIsCapturing] = useState(false);
  const [transcriptPreview, setTranscriptPreview] = useState<string | null>(
    null,
  );
  const [transcriptSourceLabel, setTranscriptSourceLabel] = useState<
    string | null
  >(null);
  const [fieldMessage, setFieldMessage] = useState<string | null>(null);
  const canSubmit =
    canSubmitAiPrompt(value, isBusy || isCapturing) &&
    !submitDisabled &&
    !readOnly;
  const visibleContextChips = contextChips
    .map((item) => item.trim())
    .filter(
      (item, index, items) => item.length > 0 && items.indexOf(item) === index,
    )
    .slice(0, 3);

  async function handleDictation() {
    if (readOnly || isBusy || dictateDisabled) return;

    setIsCapturing(true);
    setTranscriptPreview(null);
    setTranscriptSourceLabel(null);
    setFieldMessage(null);

    try {
      const dictationResult = await captureDictationAsync({
        onTranscript: (transcript) => {
          setTranscriptSourceLabel(
            getAiTranscriptSourceLabel("speech-recognition"),
          );
          setTranscriptPreview(compactAiTranscriptPreview(transcript));
        },
      });
      setTranscriptSourceLabel(
        getAiTranscriptSourceLabel(dictationResult.mode),
      );
      setFieldMessage(dictationResult.message);

      if (dictationResult.transcript) {
        onChangeText(
          appendDictationTranscript(
            latestValueRef.current,
            dictationResult.transcript,
          ),
        );
        setTranscriptPreview(
          compactAiTranscriptPreview(dictationResult.transcript),
        );
      } else {
        textInputRef.current?.focus?.();
        setTranscriptPreview(null);
      }
    } catch {
      textInputRef.current?.focus?.();
      setTranscriptSourceLabel(null);
      setFieldMessage(
        "Dictation was unavailable. The prompt field is focused so you can use device dictation or type manually.",
      );
    } finally {
      setIsCapturing(false);
    }
  }

  function handleClear() {
    if (readOnly || isBusy || clearDisabled) return;

    onChangeText("");
    setTranscriptPreview(null);
    setTranscriptSourceLabel(null);
    setFieldMessage(null);
    textInputRef.current?.focus?.();
  }

  return (
    <SectionSurface palette={palette} label={label} title={title}>
      <ChipRow style={styles.chipRow}>
        <Chip compact style={styles.chip} icon="message-text-outline">
          {getAiPromptCharacterCountLabel(value)}
        </Chip>
        <Chip
          compact
          style={styles.chip}
          icon={isCapturing ? "microphone" : "pencil"}
        >
          {isCapturing ? "Listening..." : "Review before send"}
        </Chip>
        {transcriptSourceLabel ? (
          <Chip compact style={styles.chip}>
            {transcriptSourceLabel}
          </Chip>
        ) : null}
        {visibleContextChips.map((item) => (
          <Chip key={item} compact style={styles.chip}>
            {item}
          </Chip>
        ))}
      </ChipRow>

      <TextInput
        ref={(instance: ComponentRef<typeof TextInput> | null) => {
          textInputRef.current = instance;
        }}
        mode="outlined"
        label="Prompt"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline
        numberOfLines={5}
        style={styles.input}
        editable={!readOnly}
      />

      {helperText ? (
        <Text style={[styles.copy, { color: palette.muted }]}>
          {helperText}
        </Text>
      ) : null}

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
          <Text style={[styles.previewLabel, { color: theme.colors.primary }]}>
            {transcriptTitle}
          </Text>
          <Text style={[styles.previewText, { color: theme.colors.onSurface }]}>
            {transcriptPreview}
          </Text>
        </Surface>
      ) : null}

      {fieldMessage ? (
        <Text style={[styles.meta, { color: palette.muted }]}>
          {fieldMessage}
        </Text>
      ) : null}

      {consentLabel ? (
        <Text style={[styles.meta, { color: palette.muted }]}>
          {consentLabel}
        </Text>
      ) : null}

      {footerNote ? (
        <Text style={[styles.meta, { color: palette.muted }]}>
          {footerNote}
        </Text>
      ) : null}

      <ActionButtonRow style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => void handleDictation()}
          style={styles.button}
          disabled={readOnly || isBusy || isCapturing || dictateDisabled}
          loading={isCapturing}
        >
          {dictateLabel}
        </Button>
        <Button
          mode="outlined"
          onPress={handleClear}
          style={styles.button}
          disabled={
            readOnly ||
            isBusy ||
            isCapturing ||
            clearDisabled ||
            value.trim().length === 0
          }
        >
          {clearLabel}
        </Button>
        <Button
          mode="contained"
          onPress={() => void onSubmit()}
          style={styles.button}
          disabled={!canSubmit}
          loading={isBusy}
        >
          {submitLabel}
        </Button>
      </ActionButtonRow>
    </SectionSurface>
  );
}

const styles = StyleSheet.create({
  chipRow: { marginTop: uiSpace.xs, marginBottom: uiSpace.md },
  chip: { borderRadius: uiRadius.pill },
  input: { minHeight: 120 },
  copy: { ...uiTypography.bodySmall, marginTop: uiSpace.md },
  previewCard: {
    marginTop: uiSpace.lg,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.lg,
    padding: uiSpace.lg,
  },
  previewLabel: { ...uiTypography.label, marginBottom: uiSpace.xs },
  previewText: uiTypography.body,
  meta: { ...uiTypography.bodySmall, marginTop: uiSpace.md },
  actions: { marginTop: uiSpace.xl },
  button: { alignSelf: "flex-start" },
});
