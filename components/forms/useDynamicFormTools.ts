import type { CameraMode, CameraViewRef } from "expo-camera";
import { File } from "expo-file-system";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import { TextInput } from "react-native-paper";

import {
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
import type { FormValue, FormValueMap } from "@/services/forms/workspaceForm";
import type { MediaAttachment } from "@/types/trackitup";

import { isMediaAttachmentArray } from "./dynamicFormUtils";
import type { DynamicFormFieldTools } from "./dynamicFormTypes";

type UseDynamicFormToolsArgs = {
  readOnly: boolean;
  values: FormValueMap;
  onChange: (fieldId: string, value: FormValue) => void;
};

export function useDynamicFormTools({
  onChange,
  readOnly,
  values,
}: UseDynamicFormToolsArgs): DynamicFormFieldTools {
  const cameraRef = useRef<CameraViewRef | null>(null);
  const textFieldRefs = useRef<Record<string, ComponentRef<typeof TextInput> | null>>({});
  const [activeMediaFieldId, setActiveMediaFieldId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("picture");
  const [isRecording, setIsRecording] = useState(false);
  const [busyFieldId, setBusyFieldId] = useState<string | null>(null);
  const [fieldMessages, setFieldMessages] = useState<Record<string, string>>({});

  const setFieldMessage = useCallback((fieldId: string, message: string) => {
    setFieldMessages((current) => ({ ...current, [fieldId]: message }));
  }, []);

  const setTextFieldRef = useCallback(
    (fieldId: string, ref: ComponentRef<typeof TextInput> | null) => {
      textFieldRefs.current[fieldId] = ref;
    },
    [],
  );

  const ensureCameraPermission = useCallback(async () => {
    const currentPermission = await getCameraPermissionStatusAsync();
    if (currentPermission.granted) return true;

    const requestedPermission = await requestCameraPermissionAsync();
    return requestedPermission.granted;
  }, []);

  const ensureLocationPermission = useCallback(async () => {
    const currentPermission = await getLocationPermissionStatusAsync();
    if (currentPermission.granted) return true;

    const requestedPermission = await requestLocationPermissionAsync();
    return requestedPermission.granted;
  }, []);

  const appendMedia = useCallback(
    (fieldId: string, attachment: MediaAttachment) => {
      const currentAttachments = isMediaAttachmentArray(values[fieldId])
        ? values[fieldId]
        : [];

      onChange(fieldId, [...currentAttachments, attachment]);
    },
    [onChange, values],
  );

  const handleOpenCamera = useCallback(
    async (fieldId: string) => {
      if (readOnly) return;

      setBusyFieldId(fieldId);
      try {
        const granted = await ensureCameraPermission();
        if (!granted) {
          setFieldMessage(fieldId, "Camera permission is required to capture media.");
          return;
        }

        setActiveMediaFieldId(fieldId);
        setFieldMessage(fieldId, "Camera ready for a new attachment.");
      } finally {
        setBusyFieldId(null);
      }
    },
    [ensureCameraPermission, readOnly, setFieldMessage],
  );

  const handlePickFile = useCallback(
    async (fieldId: string) => {
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
    },
    [appendMedia, readOnly, setFieldMessage],
  );

  const handleCaptureMedia = useCallback(
    async (fieldId: string) => {
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
    },
    [appendMedia, cameraMode, readOnly, setFieldMessage],
  );

  const handleStopRecording = useCallback(
    async (fieldId: string) => {
      if (!cameraRef.current) return;

      try {
        await cameraRef.current.stopRecording();
        setFieldMessage(fieldId, "Recording stopped.");
      } catch {
        setFieldMessage(fieldId, "Unable to stop recording cleanly.");
      }
    },
    [setFieldMessage],
  );

  const handleCaptureLocation = useCallback(
    async (fieldId: string, source: "current" | "last-known") => {
      if (readOnly) return;

      setBusyFieldId(fieldId);
      try {
        const granted = await ensureLocationPermission();
        if (!granted) {
          setFieldMessage(fieldId, "Location permission is required to attach GPS context.");
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
    },
    [ensureLocationPermission, onChange, readOnly, setFieldMessage],
  );

  const handleDictation = useCallback(
    async (fieldId: string) => {
      if (readOnly) return;

      setBusyFieldId(fieldId);

      try {
        const dictationResult = await captureDictationAsync();
        const currentValue = typeof values[fieldId] === "string" ? values[fieldId] : "";

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
    },
    [onChange, readOnly, setFieldMessage, values],
  );

  return useMemo(
    () => ({
      cameraRef,
      activeMediaFieldId,
      cameraMode,
      isRecording,
      busyFieldId,
      fieldMessages,
      setCameraMode,
      setTextFieldRef,
      closeCamera: () => setActiveMediaFieldId(null),
      handleDictation,
      handleOpenCamera,
      handlePickFile,
      handleCaptureMedia,
      handleStopRecording,
      handleCaptureLocation,
    }),
    [
      activeMediaFieldId,
      busyFieldId,
      cameraMode,
      fieldMessages,
      handleCaptureLocation,
      handleCaptureMedia,
      handleDictation,
      handleOpenCamera,
      handlePickFile,
      handleStopRecording,
      isRecording,
      setTextFieldRef,
    ],
  );
}
