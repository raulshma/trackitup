export const HOME_DASHBOARD_SECTION_STORAGE_KEY =
  "trackitup.home-dashboard.section.v1";

export const HOME_DASHBOARD_SECTION_OPTIONS = [
  "overview",
  "capture",
  "spaces",
  "manage",
] as const;

export type HomeDashboardSection =
  (typeof HOME_DASHBOARD_SECTION_OPTIONS)[number];

export const DEFAULT_HOME_DASHBOARD_SECTION: HomeDashboardSection = "overview";

export function normalizeHomeDashboardSection(
  value: unknown,
): HomeDashboardSection {
  return HOME_DASHBOARD_SECTION_OPTIONS.includes(value as HomeDashboardSection)
    ? (value as HomeDashboardSection)
    : DEFAULT_HOME_DASHBOARD_SECTION;
}
