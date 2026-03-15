const AI_DIRECTORY = "trackitup";
const AI_TELEMETRY_FILENAME = "ai-telemetry-v1.json";

export const AI_TELEMETRY_SURFACES = [
  "account-settings",
  "schema-builder",
  "dashboard-pulse",
  "inventory-lifecycle-brief",
  "logbook-draft",
  "planner-risk-brief",
  "tracking-quality-brief",
  "visual-recap",
  "planner-copilot",
  "action-center-explainer",
  "scanner-assistant",
  "workspace-q-and-a",
  "cross-space-trends",
] as const;

export type AiTelemetrySurface = (typeof AI_TELEMETRY_SURFACES)[number];

export const AI_TELEMETRY_WORKFLOW_SURFACE_CHIPS = [
  { label: "Schema", surface: "schema-builder" },
  { label: "Logbook", surface: "logbook-draft" },
  { label: "Recap", surface: "visual-recap" },
  { label: "Planner", surface: "planner-copilot" },
  { label: "Risk", surface: "planner-risk-brief" },
  { label: "Action", surface: "action-center-explainer" },
  { label: "Track", surface: "tracking-quality-brief" },
  { label: "Inventory", surface: "inventory-lifecycle-brief" },
  { label: "Scanner", surface: "scanner-assistant" },
  { label: "Q&A", surface: "workspace-q-and-a" },
  { label: "Pulse", surface: "dashboard-pulse" },
  { label: "Trends", surface: "cross-space-trends" },
] as const satisfies ReadonlyArray<{
  label: string;
  surface: Exclude<AiTelemetrySurface, "account-settings">;
}>;

export type AiTelemetryAction =
  | "generate-requested"
  | "generate-succeeded"
  | "generate-failed"
  | "draft-applied"
  | "action-plan-created"
  | "action-plan-approved"
  | "action-plan-rejected"
  | "action-plan-executed"
  | "key-saved"
  | "key-cleared"
  | "prompt-history-enabled"
  | "prompt-history-disabled";

export type AiTelemetryEvent = {
  surface: AiTelemetrySurface;
  action: AiTelemetryAction;
  at?: string;
};

export type AiTelemetrySurfaceSummary = {
  totalEvents: number;
  generationRequests: number;
  generationSuccesses: number;
  generationFailures: number;
  draftApplies: number;
  lastEventAt?: string;
};

export type AiTelemetrySummary = {
  totalEvents: number;
  generationRequests: number;
  generationSuccesses: number;
  generationFailures: number;
  draftApplies: number;
  lastEventAt?: string;
  surfaces: Record<AiTelemetrySurface, AiTelemetrySurfaceSummary>;
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const AI_TELEMETRY_STORAGE_KEY = "trackitup.ai.telemetry.summary.v1";

function createEmptySurfaceSummary(): AiTelemetrySurfaceSummary {
  return {
    totalEvents: 0,
    generationRequests: 0,
    generationSuccesses: 0,
    generationFailures: 0,
    draftApplies: 0,
  };
}

function buildSurfaceRecord<T>(
  buildValue: (surface: AiTelemetrySurface) => T,
): Record<AiTelemetrySurface, T> {
  return Object.fromEntries(
    AI_TELEMETRY_SURFACES.map((surface) => [surface, buildValue(surface)]),
  ) as Record<AiTelemetrySurface, T>;
}

export function createEmptyAiTelemetrySummary(): AiTelemetrySummary {
  return {
    totalEvents: 0,
    generationRequests: 0,
    generationSuccesses: 0,
    generationFailures: 0,
    draftApplies: 0,
    surfaces: buildSurfaceRecord(() => createEmptySurfaceSummary()),
  };
}

function getStorage(): StorageLike | null {
  const maybeStorage = (
    globalThis as typeof globalThis & { localStorage?: StorageLike }
  ).localStorage;
  return maybeStorage ?? null;
}

async function loadExpoFileSystem() {
  try {
    return await import("expo-file-system");
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeSurfaceSummary(value: unknown): AiTelemetrySurfaceSummary {
  const parsed = isRecord(value) ? value : {};
  return {
    totalEvents: normalizeNumber(parsed.totalEvents),
    generationRequests: normalizeNumber(parsed.generationRequests),
    generationSuccesses: normalizeNumber(parsed.generationSuccesses),
    generationFailures: normalizeNumber(parsed.generationFailures),
    draftApplies: normalizeNumber(parsed.draftApplies),
    lastEventAt:
      typeof parsed.lastEventAt === "string" ? parsed.lastEventAt : undefined,
  };
}

function normalizeAiTelemetrySummary(value: unknown): AiTelemetrySummary {
  const fallback = createEmptyAiTelemetrySummary();
  if (!isRecord(value)) return fallback;

  const parsedSurfaces = isRecord(value.surfaces) ? value.surfaces : {};

  return {
    totalEvents: normalizeNumber(value.totalEvents),
    generationRequests: normalizeNumber(value.generationRequests),
    generationSuccesses: normalizeNumber(value.generationSuccesses),
    generationFailures: normalizeNumber(value.generationFailures),
    draftApplies: normalizeNumber(value.draftApplies),
    lastEventAt:
      typeof value.lastEventAt === "string" ? value.lastEventAt : undefined,
    surfaces: buildSurfaceRecord((surface) =>
      normalizeSurfaceSummary(parsedSurfaces[surface]),
    ),
  };
}

async function readPersistedSummary(): Promise<AiTelemetrySummary> {
  const expoFileSystem = await loadExpoFileSystem();
  if (!expoFileSystem?.Paths?.document) {
    return createEmptyAiTelemetrySummary();
  }

  try {
    const telemetryFile = new expoFileSystem.File(
      expoFileSystem.Paths.document,
      AI_DIRECTORY,
      AI_TELEMETRY_FILENAME,
    );
    if (!telemetryFile.exists) return createEmptyAiTelemetrySummary();
    return normalizeAiTelemetrySummary(JSON.parse(telemetryFile.textSync()));
  } catch {
    return createEmptyAiTelemetrySummary();
  }
}

async function persistAiTelemetrySummary(summary: AiTelemetrySummary) {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(AI_TELEMETRY_STORAGE_KEY, JSON.stringify(summary));
    } catch {
      // Keep the in-memory result if browser storage is unavailable.
    }
    return;
  }

  const expoFileSystem = await loadExpoFileSystem();
  if (!expoFileSystem?.Paths?.document) return;

  try {
    const directory = new expoFileSystem.Directory(
      expoFileSystem.Paths.document,
      AI_DIRECTORY,
    );
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }

    const telemetryFile = new expoFileSystem.File(
      expoFileSystem.Paths.document,
      AI_DIRECTORY,
      AI_TELEMETRY_FILENAME,
    );
    if (!telemetryFile.exists) {
      telemetryFile.create({ intermediates: true, overwrite: true });
    }

    telemetryFile.write(JSON.stringify(summary));
  } catch {
    // Ignore telemetry persistence failures.
  }
}

export async function loadAiTelemetrySummary(): Promise<AiTelemetrySummary> {
  const storage = getStorage();
  if (storage) {
    try {
      return normalizeAiTelemetrySummary(
        JSON.parse(storage.getItem(AI_TELEMETRY_STORAGE_KEY) ?? "null"),
      );
    } catch {
      return createEmptyAiTelemetrySummary();
    }
  }

  return await readPersistedSummary();
}

export function applyAiTelemetryEvent(
  summary: AiTelemetrySummary,
  event: AiTelemetryEvent,
): AiTelemetrySummary {
  const nextSummary = normalizeAiTelemetrySummary(summary);
  const at = event.at ?? new Date().toISOString();
  const nextSurface = {
    ...nextSummary.surfaces[event.surface],
    totalEvents: nextSummary.surfaces[event.surface].totalEvents + 1,
    lastEventAt: at,
  };

  if (event.action === "generate-requested") {
    nextSummary.generationRequests += 1;
    nextSurface.generationRequests += 1;
  }

  if (event.action === "generate-succeeded") {
    nextSummary.generationSuccesses += 1;
    nextSurface.generationSuccesses += 1;
  }

  if (event.action === "generate-failed") {
    nextSummary.generationFailures += 1;
    nextSurface.generationFailures += 1;
  }

  if (event.action === "draft-applied") {
    nextSummary.draftApplies += 1;
    nextSurface.draftApplies += 1;
  }

  nextSummary.totalEvents += 1;
  nextSummary.lastEventAt = at;
  nextSummary.surfaces[event.surface] = nextSurface;
  return nextSummary;
}

export async function recordAiTelemetryEvent(event: AiTelemetryEvent) {
  const current = await loadAiTelemetrySummary();
  const next = applyAiTelemetryEvent(current, event);
  await persistAiTelemetrySummary(next);
  return next;
}

export function formatAiTelemetryLastEventLabel(timestamp?: string) {
  if (!timestamp) return "No activity yet";

  return `Last AI activity ${new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}
