export const THEME_PREFERENCE_STORAGE_KEY = "trackitup.theme.preference.v1";
export const THEME_ACCENT_STORAGE_KEY = "trackitup.theme.accent.v1";
export const THEME_PREFERENCE_OPTIONS = [
  "light",
  "dark",
  "oled",
  "monotone-light",
  "monotone-dark",
] as const;
export const THEME_ACCENT_PRESETS = [
  {
    id: "classic-blue",
    label: "Classic Blue",
    color: "#1a73e8",
  },
  {
    id: "emerald",
    label: "Emerald",
    color: "#10b981",
  },
  {
    id: "violet",
    label: "Violet",
    color: "#8b5cf6",
  },
  {
    id: "rose",
    label: "Rose",
    color: "#ec4899",
  },
  {
    id: "amber",
    label: "Amber",
    color: "#f59e0b",
  },
  {
    id: "teal",
    label: "Teal",
    color: "#0ea5e9",
  },
] as const;

export type ThemePreference = (typeof THEME_PREFERENCE_OPTIONS)[number];
export type ThemeAccentPreset = (typeof THEME_ACCENT_PRESETS)[number];
export type ThemeAccentPresetId = ThemeAccentPreset["id"];

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "dark";
export const DEFAULT_THEME_ACCENT_COLOR = THEME_ACCENT_PRESETS[0].color;

export function isValidHexColor(value: unknown): value is string {
  return (
    typeof value === "string" && /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
  );
}

export function normalizeThemeAccentColor(value: unknown): string {
  if (!isValidHexColor(value)) {
    return DEFAULT_THEME_ACCENT_COLOR;
  }

  const normalized = value.startsWith("#") ? value.slice(1) : value;
  if (normalized.length === 3) {
    return `#${normalized
      .split("")
      .map((channel) => channel + channel)
      .join("")
      .toLowerCase()}`;
  }

  return `#${normalized.toLowerCase()}`;
}

export function getThemeAccentPreset(
  color: string,
): ThemeAccentPreset | undefined {
  const normalized = normalizeThemeAccentColor(color);
  return THEME_ACCENT_PRESETS.find((preset) => preset.color === normalized);
}

export function getThemeAccentPresetId(
  color: string,
): ThemeAccentPresetId | "custom" {
  return getThemeAccentPreset(color)?.id ?? "custom";
}

export function getThemeAccentLabel(color: string): string {
  return getThemeAccentPreset(color)?.label ?? "Custom";
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  return THEME_PREFERENCE_OPTIONS.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : DEFAULT_THEME_PREFERENCE;
}

export function isDarkThemePreference(preference: ThemePreference): boolean {
  return preference !== "light" && preference !== "monotone-light";
}

export function getThemeBackgroundColor(preference: ThemePreference): string {
  switch (preference) {
    case "light":
      return "#f8fafc";
    case "oled":
      return "#000000";
    case "monotone-light":
      return "#ffffff";
    case "monotone-dark":
      return "#0b0b0b";
    default:
      return "#111318";
  }
}
