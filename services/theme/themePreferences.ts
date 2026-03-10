export const THEME_PREFERENCE_STORAGE_KEY = "trackitup.theme.preference.v1";
export const THEME_PREFERENCE_OPTIONS = ["light", "dark", "oled"] as const;

export type ThemePreference = (typeof THEME_PREFERENCE_OPTIONS)[number];

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "dark";

export function normalizeThemePreference(value: unknown): ThemePreference {
  return THEME_PREFERENCE_OPTIONS.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : DEFAULT_THEME_PREFERENCE;
}

export function isDarkThemePreference(preference: ThemePreference): boolean {
  return preference !== "light";
}

export function getThemeBackgroundColor(preference: ThemePreference): string {
  switch (preference) {
    case "light":
      return "#f7f9fc";
    case "oled":
      return "#000000";
    default:
      return "#111318";
  }
}