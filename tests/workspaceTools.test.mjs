import assert from "node:assert/strict";
import test from "node:test";

const { trackItUpWorkspace } = await import("../constants/TrackItUpData.ts");
const { parseWorkspaceLogCsv } =
  await import("../services/import/workspaceCsvImport.ts");
const {
  buildWorkspaceExportJson,
  buildWorkspaceLogsCsv,
  buildWorkspaceSummaryHtml,
} = await import("../services/export/workspaceExportContent.ts");
const {
  buildMetricChartPoints,
  buildReminderCalendar,
  findAssetByScannedCode,
} = await import("../services/insights/workspaceInsights.ts");
const {
  buildInitialFormValues,
  buildLogEntriesFromActionDraft,
  buildLogEntryFromActionDraft,
  formatCapturedLocation,
  getFieldOptions,
  normalizeFormValues,
  validateFormValues,
} = await import("../services/forms/workspaceForm.ts");
const {
  cycleDashboardWidgetSize,
  moveDashboardWidgets,
  toggleDashboardWidgetVisibility,
} = await import("../services/dashboard/dashboardWidgets.ts");
const { getQuickActionFormTemplate } =
  await import("../constants/TrackItUpFormTemplates.ts");
const { buildTimelineEntriesFromLogs } =
  await import("../constants/TrackItUpSelectors.ts");
const { createEmptyWorkspaceSnapshot } =
  await import("../constants/TrackItUpDefaults.ts");
const { choosePersistenceMode, normalizeWorkspaceSnapshot } =
  await import("../services/offline/workspacePersistenceStrategy.ts");
const {
  buildWorkspaceSyncPayload,
  enqueueWorkspaceSync,
  markWorkspaceSyncComplete,
  pullWorkspaceSync,
  resolvePulledWorkspaceSnapshot,
} = await import("../services/offline/workspaceSync.ts");
const { appendDictationTranscript } =
  await import("../services/device/dictation.ts");
const { applyReminderTriggerRules, getNextReminderDate } =
  await import("../services/reminders/reminderRules.ts");
const {
  buildCustomSchemaTemplate,
  customSchemaFieldPresets,
  hasCustomSchemaFieldLabelConflict,
} = await import("../services/templates/customSchema.ts");
const { createWorkspaceSpace } =
  await import("../services/spaces/workspaceSpaces.ts");
const { getSpaceCreationSuggestion, mapTemplateCategoryToSpaceCategory } =
  await import("../services/spaces/spaceCreationSuggestions.ts");
const { getLinkedLogEntries } =
  await import("../services/logs/logRelationships.ts");
const { applyTemplateImportToWorkspace, parseTemplateImportUrl } =
  await import("../services/templates/templateImport.ts");
const {
  DEFAULT_THEME_PREFERENCE,
  getThemeBackgroundColor,
  isDarkThemePreference,
  normalizeThemePreference,
} = await import("../services/theme/themePreferences.ts");

function createSnapshot(overrides = {}) {
  return {
    ...structuredClone(trackItUpWorkspace),
    ...overrides,
  };
}

test("workspace CSV export/import roundtrips key log fields", () => {
  const snapshot = createSnapshot({
    logs: [
      {
        id: "log-roundtrip",
        spaceId: "reef",
        kind: "asset-update",
        title: 'Dosed, checked "corals"',
        note: 'Added "trace", stable',
        occurredAt: "2026-03-09T10:00:00.000Z",
        assetIds: ["asset-filter"],
        tags: ["dose", "reef,care"],
        cost: 18.75,
        locationLabel: "Cabinet, left side",
        attachmentsCount: 2,
      },
    ],
  });

  const json = buildWorkspaceExportJson(snapshot);
  assert.equal(JSON.parse(json).logs[0].title, 'Dosed, checked "corals"');

  const csv = buildWorkspaceLogsCsv(snapshot);
  assert.match(csv, /"Dosed, checked ""corals"""/);
  assert.match(csv, /"Added ""trace"", stable"/);
  assert.match(csv, /"Cabinet, left side"/);

  const result = parseWorkspaceLogCsv(csv, snapshot);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.logs.length, 1);
  assert.equal(result.logs[0].spaceId, "reef");
  assert.equal(result.logs[0].kind, "asset-update");
  assert.equal(result.logs[0].title, 'Dosed, checked "corals"');
  assert.equal(result.logs[0].note, 'Added "trace", stable');
  assert.deepEqual(result.logs[0].assetIds, ["asset-filter"]);
  assert.deepEqual(result.logs[0].tags, ["dose", "reef,care"]);
  assert.equal(result.logs[0].cost, 18.75);
  assert.equal(result.logs[0].locationLabel, "Cabinet, left side");
  assert.equal(result.logs[0].attachmentsCount, 2);
  assert.match(result.logs[0].id, /^log-import-/);
});

test("workspace CSV import validates required columns", () => {
  const result = parseWorkspaceLogCsv(
    "kind,note\nasset-update,hello",
    trackItUpWorkspace,
  );

  assert.equal(result.logs.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /must include `title`/i);
});

test("workspace CSV export neutralizes spreadsheet formula cells", () => {
  const snapshot = createSnapshot({
    logs: [
      {
        id: "log-formula-export",
        spaceId: "reef",
        kind: "asset-update",
        title: '=HYPERLINK("https://example.com")',
        note: "+cmd|' /C calc'!A0",
        occurredAt: "2026-03-09T10:00:00.000Z",
      },
    ],
  });

  const csv = buildWorkspaceLogsCsv(snapshot);

  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example.com""\)"/);
  assert.match(csv, /"'\+cmd\|' \/C calc'!A0"/);
});

test("workspace CSV import warns and falls back for invalid row values", () => {
  const csv = [
    "title,spaceName,kind,occurredAt,assetIds,tags,cost",
    '"Pump inspection","100G Reef Tank","unknown-kind","not-a-date","asset-filter;missing-asset","maintenance;reef","22.5"',
  ].join("\n");

  const result = parseWorkspaceLogCsv(csv, trackItUpWorkspace);

  assert.equal(result.logs.length, 1);
  assert.equal(result.logs[0].kind, "asset-update");
  assert.deepEqual(result.logs[0].assetIds, ["asset-filter"]);
  assert.deepEqual(result.logs[0].tags, ["maintenance", "reef"]);
  assert.equal(result.logs[0].cost, 22.5);
  assert.ok(Date.parse(result.logs[0].occurredAt));
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0], /invalid occurredAt/i);
  assert.match(result.warnings[1], /assetIds were ignored/i);
});

test("workspace summary export includes overview, reminders, and recent log sections", () => {
  const html = buildWorkspaceSummaryHtml(trackItUpWorkspace);

  assert.match(html, /TrackItUp workspace report/);
  assert.match(html, /Space overview/);
  assert.match(html, /Upcoming reminders/);
  assert.match(html, /Recent logbook activity/);
  assert.match(html, /Tracked spend/);
  assert.match(html, /100G Reef Tank/);
});

test("workspace sync helpers queue and clear pending operations", () => {
  const queuedSnapshot = enqueueWorkspaceSync(trackItUpWorkspace, {
    kind: "logs-imported",
    summary: "Imported 2 log(s) from CSV",
  });

  assert.equal(queuedSnapshot.syncQueue.length, 1);
  assert.equal(queuedSnapshot.syncQueue[0].kind, "logs-imported");

  const payload = buildWorkspaceSyncPayload(queuedSnapshot, "user_123");
  assert.equal(payload.userId, "user_123");
  assert.equal(payload.queuedOperations.length, 1);

  const clearedSnapshot = markWorkspaceSyncComplete(
    queuedSnapshot,
    "2026-03-10T12:30:00.000Z",
  );
  assert.equal(clearedSnapshot.syncQueue.length, 0);
  assert.equal(clearedSnapshot.lastSyncAt, "2026-03-10T12:30:00.000Z");
});

test("workspace sync helpers can resolve and pull a remote snapshot", async () => {
  const remoteSnapshot = createSnapshot({
    generatedAt: "2026-03-11T09:15:00.000Z",
    syncQueue: [],
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.match(String(input), /mode=pull/);
    assert.doesNotMatch(String(input), /userId=/);
    assert.equal(init?.method, "GET");
    assert.equal(init?.headers["x-trackitup-user-id"], "user_123");
    return new Response(JSON.stringify({ snapshot: remoteSnapshot }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const resolvedSnapshot = resolvePulledWorkspaceSnapshot(
      { snapshot: remoteSnapshot },
      trackItUpWorkspace,
    );
    const pullResult = await pullWorkspaceSync({
      endpoint: "https://example.com/api/trackitup-sync",
      fallbackSnapshot: trackItUpWorkspace,
      userId: "user_123",
      getToken: async () => "token-123",
    });

    assert.equal(resolvedSnapshot?.generatedAt, remoteSnapshot.generatedAt);
    assert.equal(pullResult.status, "success");
    assert.equal(pullResult.snapshot?.generatedAt, remoteSnapshot.generatedAt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("template import parsing supports deep links and QR payload fields", () => {
  const parsed = parseTemplateImportUrl(
    "trackitup://template-import?name=Trail%20Foraging&category=Outdoor&origin=community&fields=text,rich-text,location,media&methods=deep-link,qr-code",
    "qr-code",
  );

  assert.equal(parsed?.name, "Trail Foraging");
  assert.equal(parsed?.category, "Outdoor");
  assert.equal(parsed?.origin, "community");
  assert.equal(parsed?.importedVia, "qr-code");
  assert.deepEqual(parsed?.supportedFieldTypes, [
    "text",
    "rich-text",
    "location",
    "media",
  ]);
});

test("template import parsing only accepts trackitup or dedicated https import routes", () => {
  const httpsImport = parseTemplateImportUrl(
    "https://example.com/template-import?name=Trail%20Foraging&category=Outdoor",
    "deep-link",
  );

  assert.equal(httpsImport?.name, "Trail Foraging");
  assert.equal(
    parseTemplateImportUrl(
      "https://example.com/?name=Trail%20Foraging&category=Outdoor",
      "deep-link",
    ),
    null,
  );
  assert.equal(
    parseTemplateImportUrl(
      "http://example.com/template-import?name=Trail%20Foraging&category=Outdoor",
      "deep-link",
    ),
    null,
  );
});

test("template import parsing trims oversized text payload fields", () => {
  const parsed = parseTemplateImportUrl(
    `trackitup://template-import?name=${"A".repeat(120)}&summary=${"B".repeat(400)}&category=${"C".repeat(90)}`,
    "deep-link",
  );

  assert.equal(parsed?.name?.length, 80);
  assert.equal(parsed?.summary?.length, 280);
  assert.equal(parsed?.category?.length, 60);
});

test("template import adds new shared templates and avoids duplicates", () => {
  const imported = applyTemplateImportToWorkspace(
    createSnapshot(),
    "trackitup://template-import?name=Trail%20Foraging&category=Outdoor&origin=community&fields=text,rich-text,location,media",
    "deep-link",
  );

  assert.equal(imported.status, "imported");
  assert.equal(imported.workspace.templates[0].name, "Trail Foraging");

  const duplicate = applyTemplateImportToWorkspace(
    imported.workspace,
    "trackitup://template-import?name=Trail%20Foraging&category=Outdoor",
    "deep-link",
  );

  assert.equal(duplicate.status, "existing");
  assert.equal(
    duplicate.workspace.templates.length,
    imported.workspace.templates.length,
  );
});

test("dictation transcript helper appends speech cleanly", () => {
  assert.equal(
    appendDictationTranscript("", "Weekly water change"),
    "Weekly water change",
  );
  assert.equal(
    appendDictationTranscript("Checked sump", "added carbon"),
    "Checked sump added carbon",
  );
});

test("metric chart points keep chronology and overlay values", () => {
  const snapshot = createSnapshot({
    logs: [
      {
        id: "log-older",
        spaceId: "reef",
        kind: "metric-reading",
        title: "Older chemistry",
        occurredAt: "2026-03-02T08:00:00.000Z",
        metricReadings: [
          { metricId: "metric-salinity", value: 1.026, unitLabel: "SG" },
          { metricId: "metric-alkalinity", value: 8.6, unitLabel: "dKH" },
        ],
        tags: [],
      },
      {
        id: "log-newer",
        spaceId: "reef",
        kind: "metric-reading",
        title: "Newer chemistry",
        occurredAt: "2026-03-03T08:00:00.000Z",
        metricReadings: [
          { metricId: "metric-salinity", value: 1.025, unitLabel: "SG" },
        ],
        tags: [],
      },
    ],
  });

  const points = buildMetricChartPoints(snapshot, [
    "metric-salinity",
    "metric-alkalinity",
  ]);

  assert.equal(points.length, 2);
  assert.equal(points[0].id, "log-older");
  assert.equal(points[1].id, "log-newer");
  assert.equal(points[0].values["metric-alkalinity"], 8.6);
  assert.equal(points[1].values["metric-salinity"], 1.025);
});

test("reminder calendar assigns open reminders to the expected day", () => {
  const calendar = buildReminderCalendar(
    "2026-03-10T08:00:00.000Z",
    trackItUpWorkspace.reminders,
  );

  const dueCell = calendar.weeks
    .flat()
    .find((cell) => cell.key === "2026-03-10");

  assert.ok(dueCell);
  assert.match(calendar.monthLabel, /March 2026/);
  assert.ok(
    dueCell.reminders.some(
      (reminder) => reminder.id === "reminder-reef-weekly",
    ),
  );
});

test("scanner lookup matches barcode and QR values case-insensitively", () => {
  const byBarcode = findAssetByScannedCode(
    trackItUpWorkspace,
    " tiu-reef-filter-01 ",
  );
  const byQr = findAssetByScannedCode(
    trackItUpWorkspace,
    "REEF-LIVESTOCK-BETTA",
  );

  assert.equal(byBarcode?.id, "asset-filter");
  assert.equal(byQr?.id, "asset-betta");
});

test("dynamic form defaults honor action-linked space and nested fields", () => {
  const action = trackItUpWorkspace.quickActions.find(
    (item) => item.id === "quick-routine",
  );
  const template = getQuickActionFormTemplate("routine-run");

  const values = buildInitialFormValues(template, trackItUpWorkspace, {
    action,
  });

  assert.equal(values.spaceId, "reef");
  assert.equal(values.routineId, "routine-reef-weekly");
  assert.deepEqual(values.steps, [
    "step-reef-water",
    "step-reef-filter",
    "step-reef-dose",
  ]);
  assert.equal(values.doseCost, "0.00");
});

test("dynamic form options and normalization follow selected workspace context", () => {
  const template = getQuickActionFormTemplate("routine-run");
  const values = normalizeFormValues(
    template,
    trackItUpWorkspace,
    {
      spaceId: "plants",
      routineId: "routine-reef-weekly",
      assetIds: ["asset-filter", "asset-monstera"],
      steps: ["step-reef-water"],
    },
    {},
  );

  const assetField = template.sections[1].fields.find(
    (field) => field.id === "assetIds",
  );
  assert.ok(assetField);
  const assetOptions = getFieldOptions(
    assetField,
    trackItUpWorkspace,
    values,
    {},
  );

  assert.equal(values.routineId, "routine-plant-feed");
  assert.deepEqual(values.assetIds, ["asset-monstera"]);
  assert.deepEqual(values.steps, []);
  assert.ok(assetOptions.every((option) => option.value !== "asset-filter"));
});

test("dynamic form validation and draft saving produce a real log entry", () => {
  const action = trackItUpWorkspace.quickActions.find(
    (item) => item.id === "quick-metric",
  );
  const template = getQuickActionFormTemplate("metric-entry");
  const invalidErrors = validateFormValues(template, {
    spaceId: "reef",
    metricId: "",
    value: "",
  });

  assert.match(invalidErrors.metricId, /required/i);
  assert.match(invalidErrors.value, /required/i);

  const entry = buildLogEntryFromActionDraft(trackItUpWorkspace, action, {
    ...buildInitialFormValues(template, trackItUpWorkspace, { action }),
    title: "Evening salinity check",
    metricId: "metric-salinity",
    value: "1.024",
    unitLabel: "SG",
    note: "Reading stabilized after the top-off.",
    tags: ["testing", "reef"],
    location: {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 5,
      capturedAt: "2026-03-10T08:30:00.000Z",
    },
    attachments: [
      {
        id: "attachment-1",
        uri: "file:///reef-photo.jpg",
        mediaType: "photo",
        capturedAt: "2026-03-10T08:31:00.000Z",
      },
      {
        id: "attachment-2",
        uri: "file:///reef-clip.mov",
        mediaType: "video",
        capturedAt: "2026-03-10T08:31:30.000Z",
      },
    ],
  });

  assert.equal(entry?.kind, "metric-reading");
  assert.equal(entry?.spaceId, "reef");
  assert.equal(entry?.metricReadings?.[0]?.metricId, "metric-salinity");
  assert.equal(entry?.metricReadings?.[0]?.value, 1.024);
  assert.equal(entry?.locationPoint?.latitude, 37.7749);
  assert.equal(entry?.locationLabel, "37.7749, -122.4194 • ±5m");
  assert.equal(entry?.attachmentsCount, 2);
  assert.equal(entry?.attachments?.[1]?.mediaType, "video");
});

test("routine macro drafts expand into a parent log plus generated step logs", () => {
  const action = trackItUpWorkspace.quickActions.find(
    (item) => item.id === "quick-routine",
  );
  const customTemplate = buildCustomSchemaTemplate({
    name: "Routine macro template",
    summary: "Routine schema with extra custom fields.",
    category: "Custom",
    quickActionKind: "routine-run",
    extraFields: [{ label: "Water clarity", type: "text" }],
  });
  const customFieldId =
    customTemplate.formTemplate.sections.at(-1)?.fields[0]?.id ??
    "custom-water-clarity";
  const logs = buildLogEntriesFromActionDraft(
    trackItUpWorkspace,
    action,
    {
      ...buildInitialFormValues(
        customTemplate.formTemplate,
        trackItUpWorkspace,
        {
          action,
        },
      ),
      spaceId: "reef",
      routineId: "routine-reef-weekly",
      steps: ["step-reef-water", "step-reef-filter"],
      [customFieldId]: "Crystal clear",
    },
    customTemplate.formTemplate,
  );

  assert.equal(logs.length, 3);
  assert.equal(logs[0].kind, "routine-run");
  assert.equal(logs[0].childLogIds?.length, 2);
  assert.equal(logs[1].parentLogId, logs[0].id);
  assert.equal(logs[0].customFieldValues?.["Water clarity"], "Crystal clear");
});

test("custom schema builder produces a launchable local template", () => {
  const template = buildCustomSchemaTemplate({
    name: "Quarantine check",
    summary: "Track fish quarantine observations.",
    category: "Aquarium",
    quickActionKind: "quick-log",
    extraFields: [{ label: "Behavior score", type: "slider", required: true }],
  });

  assert.equal(template.importMethods[0], "local");
  assert.equal(template.formTemplate?.quickActionKind, "quick-log");
  assert.ok(template.supportedFieldTypes.includes("slider"));
  assert.equal(
    template.formTemplate?.sections.at(-1)?.fields[0]?.id,
    "custom-behavior-score",
  );
  assert.equal(customSchemaFieldPresets.length > 0, true);
});

test("custom schema helpers block duplicate field labels", () => {
  assert.equal(
    hasCustomSchemaFieldLabelConflict(
      [{ label: "Observation note", type: "text" }],
      " observation note ",
    ),
    true,
  );
  assert.equal(
    hasCustomSchemaFieldLabelConflict(
      [{ label: "Observation note", type: "text" }],
      "Dose amount",
    ),
    false,
  );
});

test("workspace spaces helper creates a first local space with sensible defaults", () => {
  const snapshot = createEmptyWorkspaceSnapshot("2026-03-10T12:00:00.000Z");
  const result = createWorkspaceSpace(
    snapshot,
    { name: " Reef Tank ", category: "aquarium" },
    "2026-03-10T13:00:00.000Z",
  );

  assert.equal(result.status, "created");
  assert.equal(result.space?.id, "reef-tank");
  assert.equal(result.space?.name, "Reef Tank");
  assert.equal(result.space?.status, "planned");
  assert.equal(result.space?.themeColor, "#0f766e");
  assert.equal(
    result.space?.summary,
    "Track activity, maintenance, and notes for Reef Tank.",
  );
  assert.equal(result.workspace.spaces[0]?.id, "reef-tank");
  assert.equal(result.workspace.generatedAt, "2026-03-10T13:00:00.000Z");
});

test("workspace spaces helper validates names and avoids duplicate ids", () => {
  const snapshot = createSnapshot({
    spaces: [
      {
        id: "reef-tank",
        name: "Reef Tank",
        category: "aquarium",
        status: "stable",
        themeColor: "#0f766e",
        summary: "Existing space",
        createdAt: "2026-03-09T12:00:00.000Z",
      },
    ],
  });

  const invalid = createWorkspaceSpace(snapshot, {
    name: "   ",
    category: "aquarium",
  });
  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.workspace.spaces.length, 1);

  const duplicate = createWorkspaceSpace(
    snapshot,
    { name: "Reef Tank", category: "aquarium", summary: "Second space" },
    "2026-03-10T14:00:00.000Z",
  );
  assert.equal(duplicate.status, "created");
  assert.equal(duplicate.space?.id, "reef-tank-2");
  assert.equal(duplicate.workspace.spaces[0]?.summary, "Second space");
});

test("space creation suggestions map template categories into workspace categories", () => {
  assert.equal(mapTemplateCategoryToSpaceCategory("Aquarium"), "aquarium");
  assert.equal(mapTemplateCategoryToSpaceCategory("Gardening"), "gardening");
  assert.equal(
    mapTemplateCategoryToSpaceCategory("Vehicle Maintenance"),
    "vehicle-maintenance",
  );
  assert.equal(mapTemplateCategoryToSpaceCategory("Outdoor"), undefined);
});

test("space creation suggestions tailor copy for action and template continuation", () => {
  const templateSuggestion = getSpaceCreationSuggestion(undefined, {
    id: "template-reef-official",
    name: "Advanced Reef",
    summary: "Official aquarium schema",
    category: "Aquarium",
    origin: "official",
    importMethods: ["local"],
    supportedFieldTypes: ["text"],
  });
  assert.equal(templateSuggestion.suggestedCategory, "aquarium");
  assert.match(templateSuggestion.returnMessage, /Advanced Reef/);

  const actionSuggestion = getSpaceCreationSuggestion(
    { id: "quick-log", label: "Quick log", kind: "quick-log" },
    undefined,
  );
  assert.equal(actionSuggestion.suggestedCategory, undefined);
  assert.equal(
    actionSuggestion.primaryActionLabel,
    "Create space and continue",
  );
  assert.match(actionSuggestion.heroSubtitle, /Quick log/);
});

test("reminder rules support recurring schedules and log-triggered follow-ups", () => {
  const brakeReminder = trackItUpWorkspace.reminders.find(
    (item) => item.id === "reminder-brake-inspection",
  );
  const nextBrakeDate = getNextReminderDate(
    brakeReminder,
    "2026-03-11T08:00:00.000Z",
  );
  const reminders = applyReminderTriggerRules(
    trackItUpWorkspace.reminders,
    [
      {
        id: "log-fish-added",
        spaceId: "reef",
        kind: "asset-update",
        title: "New fish added",
        note: "Introduced one clownfish.",
        occurredAt: "2026-03-09T06:00:00.000Z",
      },
    ],
    "2026-03-09T07:00:00.000Z",
  );
  const ammoniaReminder = reminders.find(
    (item) => item.id === "reminder-reef-ammonia",
  );

  assert.equal(nextBrakeDate?.slice(0, 10), "2026-04-14");
  assert.equal(ammoniaReminder?.status, "scheduled");
  assert.equal(ammoniaReminder?.dueAt, "2026-03-10T06:00:00.000Z");
});

test("dashboard widget helpers reorder, resize, and hide cards", () => {
  const widgets = trackItUpWorkspace.dashboardWidgets;
  const movedWidgets = moveDashboardWidgets(widgets, widgets[1].id, "up");
  const resizedWidgets = cycleDashboardWidgetSize(widgets, widgets[0].id);
  const hiddenWidgets = toggleDashboardWidgetVisibility(widgets, widgets[0].id);

  assert.equal(movedWidgets[0].id, widgets[1].id);
  assert.notEqual(resizedWidgets[0].size, widgets[0].size);
  assert.equal(hiddenWidgets[0].hidden, true);
});

test("linked log helper surfaces parent and child routine logs", () => {
  const action = trackItUpWorkspace.quickActions.find(
    (item) => item.id === "quick-routine",
  );
  const logs = buildLogEntriesFromActionDraft(trackItUpWorkspace, action, {
    ...buildInitialFormValues(
      getQuickActionFormTemplate("routine-run"),
      trackItUpWorkspace,
      { action },
    ),
    spaceId: "reef",
    routineId: "routine-reef-weekly",
    steps: ["step-reef-water", "step-reef-filter"],
  });
  const linkedFromParent = getLinkedLogEntries(logs, logs[0]);
  const linkedFromChild = getLinkedLogEntries(logs, logs[1]);

  assert.equal(linkedFromParent.childEntries.length, 2);
  assert.equal(linkedFromChild.parentEntry?.id, logs[0].id);
});

test("captured locations format compact labels for the form and logs", () => {
  assert.equal(
    formatCapturedLocation({
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 4.7,
      capturedAt: "2026-03-10T08:30:00.000Z",
    }),
    "37.7749, -122.4194 • ±5m",
  );
});

test("persistence strategy prefers file-system fallback when localStorage is unavailable", () => {
  assert.equal(
    choosePersistenceMode({
      hasWatermelon: true,
      hasLocalStorage: true,
      hasFileSystem: true,
    }),
    "watermelondb",
  );
  assert.equal(
    choosePersistenceMode({ hasLocalStorage: false, hasFileSystem: true }),
    "file-system",
  );
  assert.equal(
    choosePersistenceMode({ hasLocalStorage: true, hasFileSystem: true }),
    "local-storage",
  );
});

test("theme preferences default to dark and support oled selection", () => {
  assert.equal(DEFAULT_THEME_PREFERENCE, "dark");
  assert.equal(normalizeThemePreference("light"), "light");
  assert.equal(normalizeThemePreference("dark"), "dark");
  assert.equal(normalizeThemePreference("oled"), "oled");
  assert.equal(normalizeThemePreference("system"), "dark");
  assert.equal(isDarkThemePreference("light"), false);
  assert.equal(isDarkThemePreference("dark"), true);
  assert.equal(isDarkThemePreference("oled"), true);
  assert.equal(getThemeBackgroundColor("light"), "#f7f9fc");
  assert.equal(getThemeBackgroundColor("dark"), "#111318");
  assert.equal(getThemeBackgroundColor("oled"), "#000000");
});

test("workspace snapshot normalization preserves attachments while filling defaults", () => {
  const normalized = normalizeWorkspaceSnapshot(
    {
      ...trackItUpWorkspace,
      logs: [
        {
          id: "log-with-attachment",
          spaceId: "reef",
          kind: "asset-update",
          title: "Attachment test",
          occurredAt: "2026-03-10T08:00:00.000Z",
          attachments: [
            {
              id: "attachment-1",
              uri: "file:///reef-photo.jpg",
              mediaType: "photo",
              capturedAt: "2026-03-10T08:01:00.000Z",
            },
          ],
        },
      ],
      reminders: trackItUpWorkspace.reminders.map((reminder) => ({
        ...reminder,
        history: undefined,
      })),
    },
    trackItUpWorkspace,
    (snapshot) => structuredClone(snapshot),
  );

  assert.ok(normalized);
  assert.equal(
    normalized.logs[0].attachments?.[0]?.uri,
    "file:///reef-photo.jpg",
  );
  assert.deepEqual(normalized.reminders[0].history, []);
});

test("workspace snapshot normalization strips legacy seeded data for empty fallbacks", () => {
  const normalized = normalizeWorkspaceSnapshot(
    trackItUpWorkspace,
    createEmptyWorkspaceSnapshot("2026-03-10T12:00:00.000Z"),
    (snapshot) => structuredClone(snapshot),
  );

  assert.ok(normalized);
  assert.deepEqual(normalized.spaces, []);
  assert.deepEqual(normalized.assets, []);
  assert.deepEqual(normalized.metricDefinitions, []);
  assert.deepEqual(normalized.routines, []);
  assert.deepEqual(normalized.reminders, []);
  assert.deepEqual(normalized.logs, []);
  assert.deepEqual(normalized.expenses, []);
  assert.deepEqual(normalized.templates, []);
  assert.equal(normalized.quickActions.length, 3);
  assert.equal(normalized.dashboardWidgets.length, 3);
  assert.equal(normalized.generatedAt, "2026-03-10T12:00:00.000Z");
});

test("timeline entries are built in newest-first order with linked space context", () => {
  const timelineEntries = buildTimelineEntriesFromLogs(
    [
      {
        id: "log-older",
        spaceId: "reef",
        kind: "asset-update",
        title: "Older note",
        note: "Checked cabinet",
        occurredAt: "2026-03-09T08:00:00.000Z",
      },
      {
        id: "log-newer",
        spaceId: "garage",
        kind: "routine-run",
        title: "Newer note",
        occurredAt: "2026-03-10T10:15:00.000Z",
      },
    ],
    trackItUpWorkspace.spaces,
    "2026-03-10T12:00:00.000Z",
  );

  assert.equal(timelineEntries[0].id, "log-newer");
  assert.equal(timelineEntries[0].spaceName, "Project Garage");
  assert.equal(timelineEntries[0].type, "Routine");
  assert.equal(timelineEntries[1].detail, "Checked cabinet");
});

test("timeline builders keep tag-bearing logs available for downstream filters", () => {
  const timelineEntries = buildTimelineEntriesFromLogs(
    [
      {
        id: "log-tagged",
        spaceId: "reef",
        kind: "asset-update",
        title: "Tagged note",
        note: "Tagged for timeline filters",
        occurredAt: "2026-03-10T09:30:00.000Z",
        tags: ["maintenance", "reef"],
      },
    ],
    trackItUpWorkspace.spaces,
    "2026-03-10T12:00:00.000Z",
  );

  assert.equal(timelineEntries.length, 1);
  assert.equal(timelineEntries[0].id, "log-tagged");
  assert.equal(timelineEntries[0].spaceId, "reef");
});
