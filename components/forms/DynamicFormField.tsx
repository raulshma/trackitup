import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { CameraView, type CameraMode, type CameraViewRef } from "expo-camera";
import { memo, useMemo, type ComponentRef } from "react";
import { Image, Platform } from "react-native";
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
import {
  getFieldOptions,
  getFormulaValue,
} from "@/services/forms/workspaceForm";

import { dynamicFormStyles as styles } from "./dynamicFormStyles";
import type { DynamicFormFieldProps } from "./dynamicFormTypes";
import {
  asStringList,
  describeLocationValue,
  getTagValue,
  isDictationField,
  isMediaAttachmentArray,
} from "./dynamicFormUtils";

function formatDateTimeLabel(value: Date) {
  return value.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const DynamicFormField = memo(function DynamicFormField({
  action,
  depth = 0,
  entry,
  errors,
  field,
  onChange,
  palette,
  readOnly = false,
  tools,
  values,
  workspace,
}: DynamicFormFieldProps) {
  const options = getFieldOptions(field, workspace, values, {
    action,
    entry,
  });
  const value = values[field.id];
  const error = errors[field.id];
  const parsedDateTimeValue = useMemo(() => {
    if (
      field.type !== "date-time" ||
      typeof value !== "string" ||
      !value.trim()
    ) {
      return new Date();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [field.type, value]);

  let control: React.ReactNode;

  switch (field.type) {
    case "text":
    case "rich-text":
    case "textarea":
    case "unit":
      control = (
        <>
          <TextInput
            ref={(ref: ComponentRef<typeof TextInput> | null) =>
              tools.setTextFieldRef(field.id, ref)
            }
            mode="outlined"
            label={field.label}
            value={typeof value === "string" ? value : ""}
            onChangeText={(nextValue) => onChange(field.id, nextValue)}
            disabled={readOnly}
            multiline={field.type === "rich-text" || field.type === "textarea"}
            placeholder={field.placeholder}
          />
          {isDictationField(field) ? (
            <View style={styles.inlineToolRow}>
              <Button
                mode="contained-tonal"
                onPress={() => void tools.handleDictation(field.id)}
                loading={tools.busyFieldId === field.id}
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
    case "date-time": {
      const applyDateTime = (nextDate: Date) => {
        onChange(field.id, nextDate.toISOString());
      };

      const openAndroidDateTimePicker = () => {
        if (readOnly || Platform.OS !== "android") return;

        DateTimePickerAndroid.open({
          value: parsedDateTimeValue,
          mode: "date",
          is24Hour: true,
          onChange: (dateEvent, selectedDate) => {
            if (dateEvent.type !== "set" || !selectedDate) return;

            DateTimePickerAndroid.open({
              value: selectedDate,
              mode: "time",
              is24Hour: true,
              onChange: (timeEvent, selectedTime) => {
                if (timeEvent.type !== "set" || !selectedTime) return;

                const merged = new Date(selectedDate);
                merged.setHours(
                  selectedTime.getHours(),
                  selectedTime.getMinutes(),
                  0,
                  0,
                );
                applyDateTime(merged);
              },
            });
          },
        });
      };

      control = (
        <>
          <TextInput
            mode="outlined"
            label={field.label}
            value={
              typeof value === "string" && value.trim()
                ? formatDateTimeLabel(parsedDateTimeValue)
                : ""
            }
            disabled
            placeholder={field.placeholder ?? "Choose date & time"}
          />
          {Platform.OS === "ios" ? (
            <DateTimePicker
              value={parsedDateTimeValue}
              mode="datetime"
              display="default"
              onChange={(_, selectedDate) => {
                if (!selectedDate || readOnly) return;
                applyDateTime(selectedDate);
              }}
              disabled={readOnly}
            />
          ) : (
            <View style={styles.inlineToolRow}>
              <Button
                mode="contained-tonal"
                onPress={openAndroidDateTimePicker}
                disabled={readOnly}
                style={styles.inlineToolButton}
              >
                Choose date &amp; time
              </Button>
              <Button
                mode="text"
                onPress={() => onChange(field.id, "")}
                disabled={
                  readOnly || !(typeof value === "string" && value.trim())
                }
              >
                Clear
              </Button>
            </View>
          )}
        </>
      );
      break;
    }
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
              onPress={() =>
                void tools.handleCaptureLocation(field.id, "current")
              }
              loading={tools.busyFieldId === field.id}
              disabled={readOnly}
              style={styles.toolButton}
            >
              Use current GPS
            </Button>
            <Button
              mode="outlined"
              onPress={() =>
                void tools.handleCaptureLocation(field.id, "last-known")
              }
              disabled={readOnly || tools.busyFieldId === field.id}
              style={styles.toolButton}
            >
              Last known
            </Button>
            <Button
              mode="text"
              onPress={() => onChange(field.id, null)}
              disabled={readOnly || tools.busyFieldId === field.id}
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
      const isActiveField = tools.activeMediaFieldId === field.id;
      const isAttachmentField = field.id === "attachments";
      const isRoutineProofField =
        isAttachmentField &&
        (action?.kind === "routine-run" ||
          typeof values.routineId === "string");
      const isReminderProofField =
        isAttachmentField &&
        !isRoutineProofField &&
        typeof values.reminderId === "string";
      const openCameraLabel = isRoutineProofField
        ? isActiveField
          ? "Proof camera ready"
          : "Capture proof photo"
        : isReminderProofField
          ? isActiveField
            ? "Reminder proof camera ready"
            : "Capture reminder proof"
          : isActiveField
            ? "Camera open"
            : "Open camera";
      const pickFileLabel =
        isRoutineProofField || isReminderProofField
          ? "Add existing photo"
          : "Pick file";
      const captureLabel = isRoutineProofField
        ? tools.cameraMode === "picture"
          ? "Take proof photo"
          : "Record proof clip"
        : isReminderProofField
          ? tools.cameraMode === "picture"
            ? "Take reminder proof"
            : "Record reminder proof"
          : tools.cameraMode === "picture"
            ? "Capture photo"
            : "Record clip";

      control = (
        <View>
          {isRoutineProofField || isReminderProofField ? (
            <Text style={[styles.fieldDescription, { color: palette.muted }]}>
              {isRoutineProofField
                ? "TrackItUp will attach these images to the routine log so they appear in visual history and proof-of-completion views."
                : "Attach proof photos to this reminder log so completion evidence and visual history stay linked to the reminder."}
            </Text>
          ) : null}
          <View style={styles.toolButtonRow}>
            <Button
              mode="contained-tonal"
              onPress={() => void tools.handleOpenCamera(field.id)}
              loading={tools.busyFieldId === field.id && !tools.isRecording}
              disabled={readOnly}
              style={styles.toolButton}
            >
              {openCameraLabel}
            </Button>
            <Button
              mode="outlined"
              onPress={() => void tools.handlePickFile(field.id)}
              disabled={readOnly || tools.busyFieldId === field.id}
              style={styles.toolButton}
            >
              {pickFileLabel}
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
                value={tools.cameraMode}
                onValueChange={(nextValue) =>
                  tools.setCameraMode(nextValue as CameraMode)
                }
                buttons={[
                  {
                    value: "picture",
                    label: "Photo",
                    disabled: readOnly || tools.isRecording,
                  },
                  {
                    value: "video",
                    label: "Video",
                    disabled: readOnly || tools.isRecording,
                  },
                ]}
                density="small"
              />
              <CameraView
                ref={(ref) => {
                  tools.cameraRef.current = ref as CameraViewRef | null;
                }}
                style={styles.cameraPreview}
                mode={tools.cameraMode}
                mute
              />
              <View style={styles.toolButtonRow}>
                {tools.cameraMode === "video" && tools.isRecording ? (
                  <Button
                    mode="contained"
                    onPress={() => void tools.handleStopRecording(field.id)}
                    style={styles.toolButton}
                  >
                    Stop recording
                  </Button>
                ) : (
                  <Button
                    mode="contained"
                    onPress={() => void tools.handleCaptureMedia(field.id)}
                    loading={
                      tools.busyFieldId === field.id && !tools.isRecording
                    }
                    disabled={readOnly}
                    style={styles.toolButton}
                  >
                    {captureLabel}
                  </Button>
                )}
                <Button
                  mode="outlined"
                  onPress={tools.closeCamera}
                  disabled={tools.isRecording}
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
                        attachments.filter((item) => item.id !== attachment.id),
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
      style={[
        styles.fieldCard,
        {
          backgroundColor: palette.background,
          borderColor: error ? palette.danger : palette.border,
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
          Boolean(tools.fieldMessages[field.id])
        }
      >
        {error ?? tools.fieldMessages[field.id] ?? field.placeholder ?? ""}
      </HelperText>
      {(field.children ?? []).map((child) => (
        <DynamicFormField
          key={child.id}
          action={action}
          depth={depth + 1}
          entry={entry}
          errors={errors}
          field={child}
          onChange={onChange}
          palette={palette}
          readOnly={readOnly}
          tools={tools}
          values={values}
          workspace={workspace}
        />
      ))}
    </View>
  );
});
