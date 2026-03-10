import { formatLocationPreview } from "@/services/device/deviceCapabilities";
import type { FormValue } from "@/services/forms/workspaceForm";
import type {
  CapturedLocation,
  FormFieldDefinition,
  MediaAttachment,
} from "@/types/trackitup";

export function asStringList(value: FormValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function getTagValue(value: FormValue) {
  return asStringList(value).join(", ");
}

export function isMediaAttachmentArray(value: FormValue): value is MediaAttachment[] {
  return Array.isArray(value) && value.every((item) => typeof item === "object");
}

export function isCapturedLocation(value: FormValue): value is CapturedLocation {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as CapturedLocation).latitude === "number" &&
      typeof (value as CapturedLocation).longitude === "number",
  );
}

export function describeLocationValue(value: FormValue) {
  if (isCapturedLocation(value)) {
    return formatLocationPreview(value);
  }

  return typeof value === "string" && value.trim()
    ? value
    : "No location captured yet.";
}

export function isDictationField(field: FormFieldDefinition) {
  return (
    field.type === "text" ||
    field.type === "rich-text" ||
    field.type === "textarea"
  );
}
