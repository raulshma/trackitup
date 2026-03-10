export type FoundationStatus = "implemented" | "partial" | "blocked";

export type FoundationSection = {
  title: string;
  items: {
    label: string;
    status: FoundationStatus;
    note: string;
  }[];
};

export function getFoundationSections(): FoundationSection[] {
  const hasClerkKey = Boolean(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return [
    {
      title: "New dependency foundations",
      items: [
        {
          label: "Clerk auth provider and account UX",
          status: hasClerkKey ? "implemented" : "partial",
          note: hasClerkKey
            ? "Root auth, secure token caching, and the optional account sign-in/sign-out flow are wired through the Expo-55-compatible Clerk bridge package."
            : "Clerk is installed and the account screen is ready, but sign-in remains disabled until EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is configured.",
        },
        {
          label: "Camera and location permission services",
          status: "implemented",
          note: "Expo camera and location helpers are installed, wrapped behind reusable utilities, and surfaced in workspace tools for permission checks and location previews.",
        },
        {
          label: "JSON / CSV / PDF export and CSV import services",
          status: "implemented",
          note: "Workspace tools now generate cache-backed JSON, CSV, and PDF exports and support pasted CSV log imports into the shared workspace store.",
        },
        {
          label: "Offline persistence boundary",
          status: "partial",
          note: "The app now persists the workspace through a WatermelonDB-ready async boundary, using real Watermelon tables when supported and legacy snapshot fallback paths otherwise.",
        },
        {
          label: "WatermelonDB native runtime",
          status: "partial",
          note: "WatermelonDB-backed workspace tables and hydration are wired, but native mobile builds still need the proper adapter/dev-build path before this fully replaces the legacy fallback everywhere.",
        },
      ],
    },
  ];
}
