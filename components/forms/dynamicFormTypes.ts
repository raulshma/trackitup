import type { CameraMode, CameraViewRef } from "expo-camera";
import type { ComponentRef, MutableRefObject } from "react";
import type { TextInput } from "react-native-paper";

import Colors from "@/constants/Colors";
import type {
  FormValidationErrors,
  FormValue,
  FormValueMap,
} from "@/services/forms/workspaceForm";
import type {
  FormFieldDefinition,
  FormTemplate,
  LogEntry,
  QuickAction,
  WorkspaceSnapshot,
} from "@/types/trackitup";

export type Palette = (typeof Colors)["light"];

export type DynamicFormRendererProps = {
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

export type DynamicFormFieldTools = {
  cameraRef: MutableRefObject<CameraViewRef | null>;
  activeMediaFieldId: string | null;
  cameraMode: CameraMode;
  isRecording: boolean;
  busyFieldId: string | null;
  fieldMessages: Record<string, string>;
  setCameraMode: (mode: CameraMode) => void;
  setTextFieldRef: (
    fieldId: string,
    ref: ComponentRef<typeof TextInput> | null,
  ) => void;
  closeCamera: () => void;
  handleDictation: (fieldId: string) => Promise<void>;
  handleOpenCamera: (fieldId: string) => Promise<void>;
  handlePickFile: (fieldId: string) => Promise<void>;
  handleCaptureMedia: (fieldId: string) => Promise<void>;
  handleStopRecording: (fieldId: string) => Promise<void>;
  handleCaptureLocation: (
    fieldId: string,
    source: "current" | "last-known",
  ) => Promise<void>;
};

export type DynamicFormFieldProps = {
  field: FormFieldDefinition;
  workspace: WorkspaceSnapshot;
  values: FormValueMap;
  errors: FormValidationErrors;
  palette: Palette;
  readOnly?: boolean;
  action?: QuickAction;
  entry?: LogEntry;
  onChange: (fieldId: string, value: FormValue) => void;
  tools: DynamicFormFieldTools;
  depth?: number;
};
