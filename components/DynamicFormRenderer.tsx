import { CameraView, type CameraMode, type CameraViewRef } from "expo-camera";
import { File } from "expo-file-system";
import {
    memo,
    useRef,
    useState,
    type ComponentRef,
    type ReactNode,
} from "react";
import { Image, StyleSheet } from "react-native";
import {
    Button,
    Checkbox,
    Chip,
    HelperText,
    SegmentedButtons,
    Switch,
    TextInput,
} from "react-native-paper";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import {
    formatLocationPreview,
    getCameraPermissionStatusAsync,
    getCurrentLocationPreviewAsync,
    getLastKnownLocationPreviewAsync,
    getLocationPermissionStatusAsync,
    requestCameraPermissionAsync,
    requestLocationPermissionAsync,
} from "@/services/device/deviceCapabilities";
import {
    appendDictationTranscript,
    captureDictationAsync,
} from "@/services/device/dictation";
import {
    getFieldOptions,
    getFormulaValue,
    type FormValidationErrors,
    type FormValue,
    type FormValueMap,
} from "@/services/forms/workspaceForm";
import type {
    CapturedLocation,
    FormFieldDefinition,
    FormTemplate,
    LogEntry,
    MediaAttachment,
    QuickAction,
    WorkspaceSnapshot,
} from "@/types/trackitup";

type Palette = (typeof Colors)["light"];

type DynamicFormRendererProps = {
  template: FormTemplate;
  workspace: WorkspaceSnapshot;
  values: FormValueMap;
  errors: FormValidationErrors;
  palette: Palette;
  readOnly?: boolean;
  action?: QuickAction;
  entry?: LogEntry;
  onChange: (fieldId: string, value: FormValue) => void;
};

function getTagValue(value: FormValue) {
  return asStringList(value).join(", ");
}

function asStringList(value: FormValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isMediaAttachmentArray(value: FormValue): value is MediaAttachment[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "object")
  );
}

function isCapturedLocation(value: FormValue): value is CapturedLocation {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as CapturedLocation).latitude === "number" &&
    typeof (value as CapturedLocation).longitude === "number",
  );
}

function describeLocationValue(value: FormValue) {
  if (isCapturedLocation(value)) {
    return formatLocationPreview(value);
  }

  return typeof value === "string" && value.trim()
    ? value
    : "No location captured yet.";
}

function isDictationField(field: FormFieldDefinition) {
  return (
    field.type === "text" ||
    field.type === "rich-text" ||
    field.type === "textarea"
  );
}

export const DynamicFormRenderer = memo(function DynamicFormRenderer({
  action,
  entry,
  errors,
  onChange,
  palette,
  readOnly = false,
  template,
  values,
  workspace,
}: DynamicFormRendererProps) {
  const cameraRef = useRef<CameraViewRef | null>(null);
  const textFieldRefs = useRef<
    Record<string, ComponentRef<typeof TextInput> | null>
  >({});
  const [activeMediaFieldId, setActiveMediaFieldId] = useState<string | null>(
    null,
  );
  const [cameraMode, setCameraMode] = useState<CameraMode>("picture");
  const [isRecording, setIsRecording] = useState(false);
  const [busyFieldId, setBusyFieldId] = useState<string | null>(null);
  const [fieldMessages, setFieldMessages] = useState<Record<string, string>>(
    {},
  );

  function setFieldMessage(fieldId: string, message: string) {
    setFieldMessages((current) => ({ ...current, [fieldId]: message }));
  }

  async function ensureCameraPermission() {
    const currentPermission = await getCameraPermissionStatusAsync();
    if (currentPermission.granted) return true;

    const requestedPermission = await requestCameraPermissionAsync();
    return requestedPermission.granted;
  }

  async function ensureLocationPermission() {
    const currentPermission = await getLocationPermissionStatusAsync();
    if (currentPermission.granted) return true;

    const requestedPermission = await requestLocationPermissionAsync();
    return requestedPermission.granted;
  }

  function appendMedia(fieldId: string, attachment: MediaAttachment) {
    const currentAttachments = isMediaAttachmentArray(values[fieldId])
      ? values[fieldId]
      : [];

    onChange(fieldId, [...currentAttachments, attachment]);
  }

  async function handleOpenCamera(fieldId: string) {
    if (readOnly) return;

    setBusyFieldId(fieldId);
    try {
      const granted = await ensureCameraPermission();
      if (!granted) {
        setFieldMessage(
          fieldId,
          "Camera permission is required to capture media.",
        );
        return;
      }

      setActiveMediaFieldId(fieldId);
      setFieldMessage(fieldId, "Camera ready for a new attachment.");
    } finally {
      setBusyFieldId(null);
    }
  }

  async function handlePickFile(fieldId: string) {
    if (readOnly) return;

    setBusyFieldId(fieldId);
    try {
      const picked = await File.pickFileAsync();
      const files = Array.isArray(picked) ? picked : [picked];
      files.forEach((file, index) => {
        appendMedia(fieldId, {
          id: `${fieldId}-file-${Date.now()}-${index}`,
          uri: file.uri,
          capturedAt: new Date().toISOString(),
          mediaType: file.type.startsWith("video/")
            ? "video"
            : file.type.startsWith("image/")
              ? "photo"
              : "file",
          mimeType: file.type,
        });
      });
      setFieldMessage(fieldId, "Attachment added from the file picker.");
    } catch {
      setFieldMessage(fieldId, "No file was selected.");
    } finally {
      setBusyFieldId(null);
    }
  }

  async function handleCaptureMedia(fieldId: string) {
    if (!cameraRef.current || readOnly) return;

    setBusyFieldId(fieldId);
    try {
      if (cameraMode === "picture") {
        const picture = await cameraRef.current.takePicture({ quality: 0.7 });
        appendMedia(fieldId, {
          id: `${fieldId}-photo-${Date.now()}`,
          uri: picture.uri,
          mediaType: "photo",
          capturedAt: new Date().toISOString(),
          width: picture.width,
          height: picture.height,
        });
        setFieldMessage(fieldId, "Photo attachment captured.");
        return;
      }

      setIsRecording(true);
      const clip = await cameraRef.current.record({ maxDuration: 30 });
      appendMedia(fieldId, {
        id: `${fieldId}-video-${Date.now()}`,
        uri: clip.uri,
        mediaType: "video",
        capturedAt: new Date().toISOString(),
      });
      setFieldMessage(fieldId, "Video attachment recorded.");
    } catch {
      setFieldMessage(fieldId, "Unable to capture media right now.");
    } finally {
      setIsRecording(false);
      setBusyFieldId(null);
    }
  }

  async function handleStopRecording(fieldId: string) {
    if (!cameraRef.current) return;

    try {
      await cameraRef.current.stopRecording();
      setFieldMessage(fieldId, "Recording stopped.");
    } catch {
      setFieldMessage(fieldId, "Unable to stop recording cleanly.");
    }
  }

  async function handleCaptureLocation(
    fieldId: string,
    source: "current" | "last-known",
  ) {
    if (readOnly) return;

    setBusyFieldId(fieldId);
    try {
      const granted = await ensureLocationPermission();
      if (!granted) {
        setFieldMessage(
          fieldId,
          "Location permission is required to attach GPS context.",
        );
        return;
      }

      const location =
        source === "current"
          ? await getCurrentLocationPreviewAsync()
          : await getLastKnownLocationPreviewAsync();
      if (!location) {
        setFieldMessage(fieldId, "No location fix is available yet.");
        return;
      }

      onChange(fieldId, location);
      setFieldMessage(fieldId, "Location attached to this form.");
    } finally {
      setBusyFieldId(null);
    }
  }

  async function handleDictation(fieldId: string) {
    if (readOnly) return;

    setBusyFieldId(fieldId);

    try {
      const dictationResult = await captureDictationAsync();
      const currentValue =
        typeof values[fieldId] === "string" ? values[fieldId] : "";

      if (dictationResult.transcript) {
        onChange(
          fieldId,
          appendDictationTranscript(currentValue, dictationResult.transcript),
        );
      } else {
        textFieldRefs.current[fieldId]?.focus?.();
      }

      setFieldMessage(fieldId, dictationResult.message);
    } catch {
      textFieldRefs.current[fieldId]?.focus?.();
      setFieldMessage(
        fieldId,
        "Dictation was unavailable. The field is focused so you can use device dictation or type manually.",
      );
    } finally {
      setBusyFieldId(null);
    }
  }

  function renderField(field: FormFieldDefinition, depth = 0): ReactNode {
    const options = getFieldOptions(field, workspace, values, {
      action,
      entry,
    });
    const value = values[field.id];
    const error = errors[field.id];

    let control: React.ReactNode;

    switch (field.type) {
      case "text":
      case "rich-text":
      case "textarea":
      case "unit":
      case "date-time":
        control = (
          <>
            <TextInput
              ref={(ref) => {
                textFieldRefs.current[field.id] = ref;
              }}
              mode="outlined"
              label={field.label}
              value={typeof value === "string" ? value : ""}
              onChangeText={(nextValue) => onChange(field.id, nextValue)}
              disabled={readOnly}
              multiline={
                field.type === "rich-text" || field.type === "textarea"
              }
              placeholder={field.placeholder}
            />
            {isDictationField(field) ? (
              <View style={styles.inlineToolRow}>
                <Button
                  mode="contained-tonal"
                  onPress={() => void handleDictation(field.id)}
                  loading={busyFieldId === field.id}
                  disabled={readOnly}
                  style={styles.inlineToolButton}
                >
                  Dictate
                </Button>
              </View>
            ) : null}
          </>
        );
        break;
      case "number":
        control = (
          <TextInput
            mode="outlined"
            label={field.label}
            value={value === null || value === undefined ? "" : String(value)}
            onChangeText={(nextValue) => onChange(field.id, nextValue)}
            disabled={readOnly}
            keyboardType="decimal-pad"
            placeholder={field.placeholder}
          />
        );
        break;
      case "location":
        control = (
          <View>
            <TextInput
              mode="outlined"
              label={field.label}
              value={describeLocationValue(value)}
              disabled
              multiline
            />
            <View style={styles.toolButtonRow}>
              <Button
                mode="contained-tonal"
                onPress={() => void handleCaptureLocation(field.id, "current")}
                loading={busyFieldId === field.id}
                disabled={readOnly}
                style={styles.toolButton}
              >
                Use current GPS
              </Button>
              <Button
                mode="outlined"
                onPress={() =>
                  void handleCaptureLocation(field.id, "last-known")
                }
                disabled={readOnly || busyFieldId === field.id}
                style={styles.toolButton}
              >
                Last known
              </Button>
              <Button
                mode="text"
                onPress={() => onChange(field.id, null)}
                disabled={readOnly || busyFieldId === field.id}
                style={styles.toolButton}
              >
                Clear
              </Button>
            </View>
          </View>
        );
        break;
      case "media": {
        const attachments = isMediaAttachmentArray(value) ? value : [];
        const isActiveField = activeMediaFieldId === field.id;

        control = (
          <View>
            <View style={styles.toolButtonRow}>
              <Button
                mode="contained-tonal"
                onPress={() => void handleOpenCamera(field.id)}
                loading={busyFieldId === field.id && !isRecording}
                disabled={readOnly}
                style={styles.toolButton}
              >
                {isActiveField ? "Camera open" : "Open camera"}
              </Button>
              <Button
                mode="outlined"
                onPress={() => void handlePickFile(field.id)}
                disabled={readOnly || busyFieldId === field.id}
                style={styles.toolButton}
              >
                Pick file
              </Button>
              <Button
                mode="text"
                onPress={() => onChange(field.id, [])}
                disabled={readOnly || attachments.length === 0}
                style={styles.toolButton}
              >
                Clear
              </Button>
            </View>

            {isActiveField ? (
              <View style={styles.capturePanel}>
                <SegmentedButtons
                  value={cameraMode}
                  onValueChange={(nextValue) =>
                    setCameraMode(nextValue as CameraMode)
                  }
                  buttons={[
                    {
                      value: "picture",
                      label: "Photo",
                      disabled: readOnly || isRecording,
                    },
                    {
                      value: "video",
                      label: "Video",
                      disabled: readOnly || isRecording,
                    },
                  ]}
                  density="small"
                />
                <CameraView
                  ref={(ref) => {
                    cameraRef.current = ref as unknown as CameraViewRef | null;
                  }}
                  style={styles.cameraPreview}
                  mode={cameraMode}
                  mute
                />
                <View style={styles.toolButtonRow}>
                  {cameraMode === "video" && isRecording ? (
                    <Button
                      mode="contained"
                      onPress={() => void handleStopRecording(field.id)}
                      style={styles.toolButton}
                    >
                      Stop recording
                    </Button>
                  ) : (
                    <Button
                      mode="contained"
                      onPress={() => void handleCaptureMedia(field.id)}
                      loading={busyFieldId === field.id && !isRecording}
                      disabled={readOnly}
                      style={styles.toolButton}
                    >
                      {cameraMode === "picture"
                        ? "Capture photo"
                        : "Record clip"}
                    </Button>
                  )}
                  <Button
                    mode="outlined"
                    onPress={() => setActiveMediaFieldId(null)}
                    disabled={isRecording}
                    style={styles.toolButton}
                  >
                    Close camera
                  </Button>
                </View>
              </View>
            ) : null}

            {attachments.length > 0 ? (
              <View style={styles.attachmentList}>
                {attachments.map((attachment) => (
                  <View
                    key={attachment.id}
                    style={[
                      styles.attachmentCard,
                      { borderColor: palette.border },
                    ]}
                  >
                    {attachment.mediaType === "photo" ? (
                      <Image
                        source={{ uri: attachment.uri }}
                        style={styles.attachmentPreview}
                      />
                    ) : null}
                    <Text style={styles.attachmentTitle}>
                      {attachment.mediaType.toUpperCase()}
                    </Text>
                    <Text
                      style={[styles.attachmentMeta, { color: palette.muted }]}
                    >
                      {attachment.uri}
                    </Text>
                    <Button
                      mode="text"
                      compact
                      onPress={() =>
                        onChange(
                          field.id,
                          attachments.filter(
                            (item) => item.id !== attachment.id,
                          ),
                        )
                      }
                      disabled={readOnly}
                    >
                      Remove
                    </Button>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyState, { color: palette.muted }]}>
                No media attached yet.
              </Text>
            )}
          </View>
        );
        break;
      }
      case "checkbox":
        control = (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{field.label}</Text>
            <Switch
              value={Boolean(value)}
              onValueChange={(nextValue) => onChange(field.id, nextValue)}
              disabled={readOnly}
            />
          </View>
        );
        break;
      case "slider":
        control = (
          <SegmentedButtons
            value={String(value ?? "75")}
            onValueChange={(nextValue) => onChange(field.id, Number(nextValue))}
            buttons={["25", "50", "75", "100"].map((option) => ({
              value: option,
              label: option,
              disabled: readOnly,
            }))}
            density="small"
          />
        );
        break;
      case "select":
        control = (
          <View style={styles.optionWrap}>
            {options.map((option) => (
              <Chip
                key={option.value}
                selected={value === option.value}
                onPress={() => onChange(field.id, option.value)}
                disabled={readOnly}
                style={styles.chip}
              >
                {option.label}
              </Chip>
            ))}
          </View>
        );
        break;
      case "multi-select":
      case "checklist": {
        const selectedValues = asStringList(value);
        control = (
          <View>
            {options.map((option) => {
              const isChecked = selectedValues.includes(option.value);
              return (
                <Checkbox.Item
                  key={option.value}
                  label={option.label}
                  status={isChecked ? "checked" : "unchecked"}
                  onPress={() =>
                    onChange(
                      field.id,
                      isChecked
                        ? selectedValues.filter((item) => item !== option.value)
                        : [...selectedValues, option.value],
                    )
                  }
                  disabled={readOnly}
                  style={styles.checkboxItem}
                />
              );
            })}
          </View>
        );
        break;
      }
      case "tags":
        control = (
          <>
            <TextInput
              mode="outlined"
              label={field.label}
              value={getTagValue(value)}
              onChangeText={(nextValue) =>
                onChange(
                  field.id,
                  nextValue
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                )
              }
              disabled={readOnly}
              placeholder="maintenance, weekly, filter-check"
            />
            <View style={styles.optionWrap}>
              {asStringList(value).map((tag) => (
                <Chip key={tag} compact style={styles.chip}>
                  {tag}
                </Chip>
              ))}
            </View>
          </>
        );
        break;
      case "formula":
        control = (
          <TextInput
            mode="outlined"
            label={field.label}
            value={getFormulaValue(field.id, workspace, values)}
            disabled
            right={<TextInput.Affix text="USD" />}
          />
        );
        break;
      default:
        control = null;
    }

    return (
      <View
        key={`${field.id}-${depth}`}
        style={[
          styles.fieldCard,
          {
            backgroundColor: palette.background,
            borderColor: error ? "#dc2626" : palette.border,
            marginLeft: depth * 10,
          },
        ]}
      >
        {field.type !== "checkbox" ? (
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            {field.required ? (
              <Text style={[styles.required, { color: palette.tint }]}>
                Required
              </Text>
            ) : null}
          </View>
        ) : null}
        {field.description ? (
          <Text style={[styles.fieldDescription, { color: palette.muted }]}>
            {field.description}
          </Text>
        ) : null}
        {control}

        <HelperText
          type={error ? "error" : "info"}
          visible={
            Boolean(error) ||
            Boolean(field.placeholder) ||
            Boolean(fieldMessages[field.id])
          }
        >
          {error ?? fieldMessages[field.id] ?? field.placeholder ?? ""}
        </HelperText>
        {(field.children ?? []).map((child) => renderField(child, depth + 1))}
      </View>
    );
  }

  return (
    <View>
      {template.sections.map((section) => (
        <View key={section.id} style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.description ? (
            <Text style={[styles.sectionCopy, { color: palette.muted }]}>
              {section.description}
            </Text>
          ) : null}
          {section.fields.map((field) => renderField(field))}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  sectionBlock: { marginTop: 4, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  sectionCopy: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  fieldCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  fieldLabel: { flex: 1, fontSize: 14, fontWeight: "700" },
  required: { fontSize: 12, fontWeight: "700" },
  fieldDescription: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: { fontSize: 14, fontWeight: "700", flex: 1, marginRight: 12 },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { marginRight: 8, marginBottom: 8 },
  checkboxItem: { paddingHorizontal: 0 },
  toolButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  inlineToolRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  inlineToolButton: {
    marginRight: 6,
  },
  toolButton: {
    marginRight: 6,
    marginBottom: 6,
  },
  capturePanel: {
    marginTop: 12,
  },
  cameraPreview: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 10,
  },
  attachmentList: {
    marginTop: 12,
    gap: 10,
  },
  attachmentCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  attachmentPreview: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
  },
  attachmentTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  attachmentMeta: { fontSize: 12, lineHeight: 18 },
  emptyState: { fontSize: 13, lineHeight: 18, marginTop: 12 },
});
