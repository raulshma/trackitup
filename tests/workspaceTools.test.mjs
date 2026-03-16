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
const { buildVisualRecapHtml, buildVisualRecapShareMessage } =
  await import("../services/export/workspaceVisualRecapContent.ts");
const {
  buildMetricChartPoints,
  buildReminderCalendar,
  findAssetByScannedCode,
} = await import("../services/insights/workspaceInsights.ts");
const {
  applyVisualRecapCoverSelections,
  buildWorkspaceVisualHistory,
  getVisualRecapCoverSelectionKey,
} = await import("../services/insights/workspaceVisualHistory.ts");
const { buildWorkspaceTrendSummary } =
  await import("../services/insights/workspaceTrendSummary.ts");
const { buildWorkspaceDashboardPulse } =
  await import("../services/insights/workspaceDashboardPulse.ts");
const { buildWorkspaceInventoryLifecycleSummary } =
  await import("../services/insights/workspaceInventoryLifecycle.ts");
const { buildWorkspacePlannerRiskSummary } =
  await import("../services/insights/workspacePlannerRisk.ts");
const { buildWorkspaceTrackingQualitySummary } =
  await import("../services/insights/workspaceTrackingQuality.ts");
const { getWorkspaceRecommendations } =
  await import("../services/insights/workspaceRecommendations.ts");
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
const { getLogKindFormTemplate, getQuickActionFormTemplate } =
  await import("../constants/TrackItUpFormTemplates.ts");
const { buildTimelineEntriesFromLogs, getOverviewStats, getSpaceSummaries } =
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
const { appendDictationTranscript, captureDictationAsync } =
  await import("../services/device/dictation.ts");
const { applyReminderTriggerRules, getNextReminderDate } =
  await import("../services/reminders/reminderRules.ts");
const { buildReminderActionCenter } =
  await import("../services/reminders/reminderActionCenter.ts");
const {
  RECURRING_NOTIFICATION_COMPLETE_ACTION_ID,
  RECURRING_NOTIFICATION_DEFAULT_ACTION_ID,
  RECURRING_NOTIFICATION_SKIP_ACTION_ID,
  REMINDER_NOTIFICATION_COMPLETE_ACTION_ID,
  REMINDER_NOTIFICATION_DEFAULT_ACTION_ID,
  REMINDER_NOTIFICATION_SKIP_ACTION_ID,
  getRecurringNotificationResponseIntent,
  getReminderNotificationResponseIntent,
} = await import("../services/reminders/reminderNotificationIntents.ts");
const {
  buildCustomSchemaTemplate,
  customSchemaFieldPresets,
  hasCustomSchemaFieldLabelConflict,
} = await import("../services/templates/customSchema.ts");
const { archiveWorkspaceSpace, createWorkspaceSpace, updateWorkspaceSpace } =
  await import("../services/spaces/workspaceSpaces.ts");
const { getSpaceCreationSuggestion, mapTemplateCategoryToSpaceCategory } =
  await import("../services/spaces/spaceCreationSuggestions.ts");
const { getLinkedLogEntries } =
  await import("../services/logs/logRelationships.ts");
const { archiveWorkspaceLog, updateWorkspaceLog } =
  await import("../services/logs/workspaceLogs.ts");
const { applyTemplateImportToWorkspace, parseTemplateImportUrl } =
  await import("../services/templates/templateImport.ts");
const {
  DEFAULT_THEME_ACCENT_COLOR,
  DEFAULT_THEME_PREFERENCE,
  getThemeAccentLabel,
  getThemeBackgroundColor,
  isDarkThemePreference,
  normalizeThemeAccentColor,
  normalizeThemePreference,
} = await import("../services/theme/themePreferences.ts");
const {
  DEFAULT_AI_PROMPT_HISTORY_ENABLED,
  normalizeAiPromptHistoryEnabled,
  normalizeOpenRouterApiKey,
} = await import("../services/ai/aiPreferences.ts");
const {
  DEFAULT_AI_MAX_OUTPUT_TOKENS,
  DEFAULT_AI_TIMEOUT_MS,
  buildTrackItUpAiHeaders,
  formatAiServiceError,
  normalizeOpenRouterTextGenerationOptions,
  normalizeOpenRouterTextModel,
} = await import("../services/ai/aiClient.ts");
const {
  DEFAULT_OPENROUTER_MODEL_SORT,
  classifyOpenRouterModelTier,
  filterOpenRouterSelectableModels,
  formatOpenRouterModelPricingLabel,
  getOpenRouterSearchHighlightParts,
  getDefaultOpenRouterModelTier,
  normalizeOpenRouterSelectableModels,
  normalizeOpenRouterModelSort,
  sortOpenRouterSelectableModels,
  supportsOpenRouterTextModel,
} = await import("../services/ai/openRouterModels.ts");
const {
  buildDashboardPulsePrompt,
  buildCrossSpaceTrendPrompt,
  buildInventoryLifecyclePrompt,
  buildActionCenterExplainerPrompt,
  buildTrackingQualityPrompt,
  buildPlannerCopilotPrompt,
  buildPlannerRiskPrompt,
  buildLogbookDraftPrompt,
  buildSchemaBuilderPrompt,
  buildVisualRecapPrompt,
} = await import("../services/ai/aiPromptBuilders.ts");
const {
  buildAiDraftReviewItems,
  formatAiDraftReviewValue,
  formatAiDraftUsageLabel,
} = await import("../services/ai/aiDraftReview.ts");
const {
  DEFAULT_AI_TRANSCRIPT_PREVIEW_MAX_LENGTH,
  canSubmitAiPrompt,
  compactAiTranscriptPreview,
  getAiPromptCharacterCountLabel,
  getAiTranscriptSourceLabel,
} = await import("../services/ai/aiTextInput.ts");
const {
  buildAiDashboardPulseGenerationPrompt,
  buildAiDashboardPulseReviewItems,
  parseAiDashboardPulseDraft,
} = await import("../services/ai/aiDashboardPulse.ts");
const {
  buildAiInventoryLifecycleGenerationPrompt,
  buildAiInventoryLifecycleReviewItems,
  parseAiInventoryLifecycleDraft,
} = await import("../services/ai/aiInventoryLifecycle.ts");
const {
  buildAiCrossSpaceTrendGenerationPrompt,
  buildAiCrossSpaceTrendReviewItems,
  parseAiCrossSpaceTrendDraft,
} = await import("../services/ai/aiCrossSpaceTrends.ts");
const {
  buildAiActionCenterExplainerGenerationPrompt,
  buildAiActionCenterExplainerReviewItems,
  parseAiActionCenterExplainerDraft,
} = await import("../services/ai/aiActionCenterExplainer.ts");
const {
  buildAiActionPlanFromActionCenterDraft,
  executeAiActionPlan,
  setAiActionPlanStepApproved,
} = await import("../services/ai/aiActionPlan.ts");
const {
  buildAiPlannerCopilotGenerationPrompt,
  buildAiPlannerCopilotReviewItems,
  parseAiPlannerCopilotDraft,
} = await import("../services/ai/aiPlannerCopilot.ts");
const {
  buildAiPlannerRiskGenerationPrompt,
  buildAiPlannerRiskReviewItems,
  parseAiPlannerRiskDraft,
} = await import("../services/ai/aiPlannerRisk.ts");
const {
  buildAiTrackingQualityGenerationPrompt,
  buildAiTrackingQualityReviewItems,
  parseAiTrackingQualityDraft,
} = await import("../services/ai/aiTrackingQuality.ts");
const {
  buildAiSchemaDraftReviewItems,
  buildAiSchemaGenerationPrompt,
  parseAiSchemaTemplateDraft,
} = await import("../services/ai/aiSchemaDraft.ts");
const {
  buildAiLogbookDraftReviewItems,
  buildAiLogbookGenerationPrompt,
  parseAiLogbookDraft,
} = await import("../services/ai/aiLogbookDraft.ts");
const {
  buildAiVisualRecapGenerationPrompt,
  buildAiVisualRecapReviewItems,
  parseAiVisualRecapDraft,
} = await import("../services/ai/aiVisualRecap.ts");
const {
  buildAiWorkspaceQaGenerationPrompt,
  buildAiWorkspaceQaReviewItems,
  parseAiWorkspaceQaDraft,
} = await import("../services/ai/aiWorkspaceQa.ts");
const {
  aiActionCenterExplainerCopy,
  aiDashboardPulseCopy,
  aiCrossSpaceTrendCopy,
  aiInventoryLifecycleCopy,
  aiLogbookDraftCopy,
  aiPlannerRiskCopy,
  aiSchemaBuilderCopy,
  aiTrackingQualityCopy,
  aiWorkspaceQaCopy,
  aiVisualRecapCopy,
} = await import("../services/ai/aiConsentCopy.ts");
const { aiAccountSettingsCopy, aiPlannerCopilotCopy } =
  await import("../services/ai/aiConsentCopy.ts");
const {
  AI_TELEMETRY_SURFACES,
  AI_TELEMETRY_WORKFLOW_SURFACE_CHIPS,
  applyAiTelemetryEvent,
  createEmptyAiTelemetrySummary,
  formatAiTelemetryLastEventLabel,
} = await import("../services/ai/aiTelemetry.ts");
const { buildWorkspaceQaPrompt } =
  await import("../services/ai/aiPromptBuilders.ts");

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
  assert.match(html, /Vehicle Maintenance/);
});

test("visual recap export content includes monthly highlights and proof counts", () => {
  const history = buildWorkspaceVisualHistory(trackItUpWorkspace, {
    spaceId: "plants",
  });
  const recap = history.monthlyRecaps[0];
  assert.ok(recap);

  const html = buildVisualRecapHtml("Plants", recap);
  const message = buildVisualRecapShareMessage("Plants", recap);

  assert.match(html, /TrackItUp visual recap/);
  assert.match(html, /Plants/);
  assert.match(html, /proof shot/i);
  assert.match(message, /Plants/);
  assert.match(message, /TrackItUp/);
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
      headers: {
        "content-type": "application/json",
        "x-trackitup-sync-version": "1",
      },
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

test("web dictation streams live transcript updates without auto-stopping on final text", async () => {
  const originalDocument = globalThis.document;
  const originalNativeModule = globalThis.ExpoSpeechRecognitionModule;
  const transcriptUpdates = [];
  const listeners = {
    result: [],
    error: [],
    end: [],
  };
  let observedStartOptions = null;

  globalThis.document = {};
  globalThis.ExpoSpeechRecognitionModule = {
    requestPermissionsAsync: async () => ({ granted: true }),
    addListener: (eventName, listener) => {
      listeners[eventName].push(listener);
      return {
        remove: () => {
          const index = listeners[eventName].indexOf(listener);
          if (index >= 0) {
            listeners[eventName].splice(index, 1);
          }
        },
      };
    },
    start: (options) => {
      observedStartOptions = options;
      listeners.result.forEach((listener) => {
        listener({
          results: [{ transcript: "reef maintenance" }],
          isFinal: false,
        });
      });
      listeners.result.forEach((listener) => {
        listener({
          results: [{ transcript: "reef maintenance note" }],
          isFinal: true,
        });
      });
      listeners.end.forEach((listener) => {
        listener();
      });
    },
    stop: () => {
      listeners.end.forEach((listener) => {
        listener();
      });
    },
  };

  try {
    const result = await captureDictationAsync({
      onTranscript: (transcript) => {
        transcriptUpdates.push(transcript);
      },
    });

    assert.equal(observedStartOptions?.interimResults, true);
    assert.equal(observedStartOptions?.continuous, true);
    assert.deepEqual(transcriptUpdates, [
      "reef maintenance",
      "reef maintenance note",
    ]);
    assert.equal(result.mode, "speech-recognition");
    assert.equal(result.transcript, "reef maintenance note");
  } finally {
    if (originalDocument === undefined) {
      Reflect.deleteProperty(globalThis, "document");
    } else {
      globalThis.document = originalDocument;
    }

    if (originalNativeModule === undefined) {
      Reflect.deleteProperty(globalThis, "ExpoSpeechRecognitionModule");
    } else {
      globalThis.ExpoSpeechRecognitionModule = originalNativeModule;
    }
  }
});

test("web dictation supports explicit stop requests via abort signal", async () => {
  const originalDocument = globalThis.document;
  const originalNativeModule = globalThis.ExpoSpeechRecognitionModule;
  const listeners = {
    result: [],
    error: [],
    end: [],
  };
  let stopCalled = false;

  globalThis.document = {};
  globalThis.ExpoSpeechRecognitionModule = {
    requestPermissionsAsync: async () => ({ granted: true }),
    addListener: (eventName, listener) => {
      listeners[eventName].push(listener);
      return {
        remove: () => {
          const index = listeners[eventName].indexOf(listener);
          if (index >= 0) {
            listeners[eventName].splice(index, 1);
          }
        },
      };
    },
    start: () => {
      listeners.result.forEach((listener) => {
        listener({
          results: [{ transcript: "reef maintenance in progress" }],
          isFinal: false,
        });
      });
    },
    stop: () => {
      stopCalled = true;
      listeners.end.forEach((listener) => {
        listener();
      });
    },
  };

  try {
    const abortController = new AbortController();
    const resultPromise = captureDictationAsync({
      signal: abortController.signal,
    });

    abortController.abort();

    const result = await resultPromise;
    assert.equal(stopCalled, true);
    assert.equal(result.mode, "speech-recognition");
    assert.equal(result.transcript, "reef maintenance in progress");
  } finally {
    if (originalDocument === undefined) {
      Reflect.deleteProperty(globalThis, "document");
    } else {
      globalThis.document = originalDocument;
    }

    if (originalNativeModule === undefined) {
      Reflect.deleteProperty(globalThis, "ExpoSpeechRecognitionModule");
    } else {
      globalThis.ExpoSpeechRecognitionModule = originalNativeModule;
    }
  }
});

test("web dictation ignores secondary alternatives to avoid duplicate phrases", async () => {
  const originalDocument = globalThis.document;
  const originalNativeModule = globalThis.ExpoSpeechRecognitionModule;
  const transcriptUpdates = [];
  const listeners = {
    result: [],
    error: [],
    end: [],
  };

  globalThis.document = {};
  globalThis.ExpoSpeechRecognitionModule = {
    requestPermissionsAsync: async () => ({ granted: true }),
    addListener: (eventName, listener) => {
      listeners[eventName].push(listener);
      return {
        remove: () => {
          const index = listeners[eventName].indexOf(listener);
          if (index >= 0) {
            listeners[eventName].splice(index, 1);
          }
        },
      };
    },
    start: () => {
      listeners.result.forEach((listener) => {
        listener({
          results: [
            {
              transcript: "check filter and pump",
            },
            {
              transcript: "check filter pump",
            },
          ],
          isFinal: true,
        });
      });
      listeners.end.forEach((listener) => {
        listener();
      });
    },
    stop: () => {
      listeners.end.forEach((listener) => {
        listener();
      });
    },
  };

  try {
    const result = await captureDictationAsync({
      onTranscript: (transcript) => {
        transcriptUpdates.push(transcript);
      },
    });

    assert.deepEqual(transcriptUpdates, ["check filter and pump"]);
    assert.equal(result.mode, "speech-recognition");
    assert.equal(result.transcript, "check filter and pump");
  } finally {
    if (originalDocument === undefined) {
      Reflect.deleteProperty(globalThis, "document");
    } else {
      globalThis.document = originalDocument;
    }

    if (originalNativeModule === undefined) {
      Reflect.deleteProperty(globalThis, "ExpoSpeechRecognitionModule");
    } else {
      globalThis.ExpoSpeechRecognitionModule = originalNativeModule;
    }
  }
});

test("native dictation uses Expo speech recognition events and streams transcript updates", async () => {
  const originalDocument = globalThis.document;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const originalNativeModule = globalThis.ExpoSpeechRecognitionModule;
  const transcriptUpdates = [];
  const listeners = {
    result: [],
    error: [],
    end: [],
  };
  let observedStartOptions = null;
  let stopCalled = false;

  const mockNativeModule = {
    requestPermissionsAsync: async () => ({ granted: true }),
    addListener: (eventName, listener) => {
      listeners[eventName].push(listener);
      return {
        remove: () => {
          const index = listeners[eventName].indexOf(listener);
          if (index >= 0) {
            listeners[eventName].splice(index, 1);
          }
        },
      };
    },
    start: (options) => {
      observedStartOptions = options;
      listeners.result.forEach((listener) => {
        listener({ results: [{ transcript: "reef" }], isFinal: false });
      });
      listeners.result.forEach((listener) => {
        listener({
          results: [{ transcript: "reef maintenance" }],
          isFinal: true,
        });
      });
      listeners.end.forEach((listener) => {
        listener();
      });
    },
    stop: () => {
      stopCalled = true;
      listeners.end.forEach((listener) => {
        listener();
      });
    },
  };

  Reflect.deleteProperty(globalThis, "document");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { product: "ReactNative" },
    writable: true,
  });
  globalThis.ExpoSpeechRecognitionModule = mockNativeModule;

  try {
    const result = await captureDictationAsync({
      onTranscript: (nextTranscript) => {
        transcriptUpdates.push(nextTranscript);
      },
    });

    assert.equal(observedStartOptions?.lang, "en-US");
    assert.equal(observedStartOptions?.interimResults, true);
    assert.equal(observedStartOptions?.continuous, true);
    assert.equal(stopCalled, false);
    assert.deepEqual(transcriptUpdates, ["reef", "reef maintenance"]);
    assert.equal(result.mode, "speech-recognition");
    assert.equal(result.transcript, "reef maintenance");
  } finally {
    if (originalDocument === undefined) {
      Reflect.deleteProperty(globalThis, "document");
    } else {
      globalThis.document = originalDocument;
    }

    if (!originalNavigatorDescriptor) {
      Reflect.deleteProperty(globalThis, "navigator");
    } else {
      Object.defineProperty(
        globalThis,
        "navigator",
        originalNavigatorDescriptor,
      );
    }

    if (originalNativeModule === undefined) {
      Reflect.deleteProperty(globalThis, "ExpoSpeechRecognitionModule");
    } else {
      globalThis.ExpoSpeechRecognitionModule = originalNativeModule;
    }
  }
});

test("native dictation falls back when microphone permission is denied", async () => {
  const originalDocument = globalThis.document;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const originalNativeModule = globalThis.ExpoSpeechRecognitionModule;

  Reflect.deleteProperty(globalThis, "document");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { product: "ReactNative" },
    writable: true,
  });
  globalThis.ExpoSpeechRecognitionModule = {
    requestPermissionsAsync: async () => ({
      granted: false,
      canAskAgain: false,
    }),
    addListener: () => ({ remove: () => {} }),
    start: () => {},
    stop: () => {},
  };

  try {
    const result = await captureDictationAsync();

    assert.equal(result.mode, "device-keyboard");
    assert.match(result.message, /permission is blocked/i);
  } finally {
    if (originalDocument === undefined) {
      Reflect.deleteProperty(globalThis, "document");
    } else {
      globalThis.document = originalDocument;
    }

    if (!originalNavigatorDescriptor) {
      Reflect.deleteProperty(globalThis, "navigator");
    } else {
      Object.defineProperty(
        globalThis,
        "navigator",
        originalNavigatorDescriptor,
      );
    }

    if (originalNativeModule === undefined) {
      Reflect.deleteProperty(globalThis, "ExpoSpeechRecognitionModule");
    } else {
      globalThis.ExpoSpeechRecognitionModule = originalNativeModule;
    }
  }
});

test("native dictation appends across pauses without repeating overlap", async () => {
  const originalDocument = globalThis.document;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const originalNativeModule = globalThis.ExpoSpeechRecognitionModule;
  const listeners = {
    result: [],
    error: [],
    end: [],
  };

  const mockNativeModule = {
    requestPermissionsAsync: async () => ({ granted: true }),
    addListener: (eventName, listener) => {
      listeners[eventName].push(listener);
      return {
        remove: () => {
          const index = listeners[eventName].indexOf(listener);
          if (index >= 0) {
            listeners[eventName].splice(index, 1);
          }
        },
      };
    },
    start: () => {
      listeners.result.forEach((listener) => {
        listener({ results: [{ transcript: "check filter" }], isFinal: true });
      });
      listeners.result.forEach((listener) => {
        listener({
          results: [{ transcript: "check filter and pump" }],
          isFinal: true,
        });
      });
      listeners.result.forEach((listener) => {
        listener({
          results: [{ transcript: "and test water" }],
          isFinal: true,
        });
      });
      listeners.end.forEach((listener) => {
        listener();
      });
    },
    stop: () => {
      listeners.end.forEach((listener) => {
        listener();
      });
    },
  };

  Reflect.deleteProperty(globalThis, "document");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { product: "ReactNative" },
    writable: true,
  });
  globalThis.ExpoSpeechRecognitionModule = mockNativeModule;

  try {
    const result = await captureDictationAsync();

    assert.equal(result.mode, "speech-recognition");
    assert.equal(result.transcript, "check filter and pump and test water");
  } finally {
    if (originalDocument === undefined) {
      Reflect.deleteProperty(globalThis, "document");
    } else {
      globalThis.document = originalDocument;
    }

    if (!originalNavigatorDescriptor) {
      Reflect.deleteProperty(globalThis, "navigator");
    } else {
      Object.defineProperty(
        globalThis,
        "navigator",
        originalNavigatorDescriptor,
      );
    }

    if (originalNativeModule === undefined) {
      Reflect.deleteProperty(globalThis, "ExpoSpeechRecognitionModule");
    } else {
      globalThis.ExpoSpeechRecognitionModule = originalNativeModule;
    }
  }
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

test("workspace recommendations prioritize overdue reminders and metric alerts", () => {
  const recommendations = getWorkspaceRecommendations(trackItUpWorkspace);

  assert.ok(recommendations.length > 0);
  assert.equal(recommendations[0].type, "overdue-reminder");
  assert.ok(recommendations.some((item) => item.type === "metric-alert"));
});

test("action center groups overdue reminders and recent reminder activity", () => {
  const center = buildReminderActionCenter(trackItUpWorkspace);

  assert.ok(center.overdue.length > 0);
  assert.ok(center.recentActivity.length > 0);
  assert.ok(center.nextBestSteps.length > 0);
  assert.ok(center.groupedBySpace.length > 0);
  assert.equal(center.summary.overdueCount, center.overdue.length);
  assert.equal(center.summary.nextBestStepCount, center.nextBestSteps.length);
});

test("action center next steps include behavior signals and deterministic priority scoring", () => {
  const snapshot = createSnapshot({
    generatedAt: "2026-03-14T10:00:00.000Z",
    reminders: trackItUpWorkspace.reminders.map((reminder, index) => {
      if (index === 0) {
        return {
          ...reminder,
          dueAt: "2026-03-13T08:00:00.000Z",
          description:
            "Capture a proof photo and log a note after finishing this maintenance step.",
          scheduleRule: { frequency: "weekly", interval: 1 },
          history: [
            {
              id: "action-center-priority-snooze-1",
              action: "snoozed",
              at: "2026-03-13T09:00:00.000Z",
              note: "Deferred to later in the day.",
            },
            {
              id: "action-center-priority-skip-1",
              action: "skipped",
              at: "2026-03-12T09:00:00.000Z",
              note: "Skipped while supplies were missing.",
            },
          ],
        };
      }

      if (index === 1) {
        return {
          ...reminder,
          dueAt: "2026-03-15T09:00:00.000Z",
          description:
            "Quick recurring checkpoint that is usually completed fast.",
          scheduleRule: { frequency: "daily", interval: 1 },
          history: [
            {
              id: "action-center-priority-complete-1",
              action: "completed",
              at: "2026-03-13T06:30:00.000Z",
              note: "Completed on time.",
            },
          ],
        };
      }

      return reminder;
    }),
  });

  const center = buildReminderActionCenter(snapshot);
  const [firstStep] = center.nextBestSteps;

  assert.ok(firstStep);
  assert.equal(typeof firstStep.priorityScore, "number");
  assert.equal(typeof firstStep.recentDeferralCount, "number");
  assert.equal(typeof firstStep.recentCompletionCount, "number");
  assert.equal(typeof firstStep.isRecurringLike, "boolean");
  assert.ok(firstStep.descriptionSnippet.length > 0);
  assert.ok(
    firstStep.priorityScore >= center.nextBestSteps.at(-1).priorityScore,
  );
  assert.ok(
    center.nextBestSteps.some(
      (item) => item.proofAffinityHint && item.proofAffinityHint.length > 0,
    ),
  );
});

test("visual history derives scoped galleries, proofs, and before-after pairs", () => {
  const snapshot = createSnapshot({
    logs: [
      {
        id: "log-photo-1",
        spaceId: "plants",
        kind: "asset-update",
        title: "Monstera baseline",
        note: "Captured the first growth photo.",
        occurredAt: "2026-02-18T09:00:00",
        assetIds: ["asset-monstera"],
        attachmentsCount: 1,
        attachments: [
          {
            id: "attachment-photo-1",
            uri: "file://photo-1.jpg",
            mediaType: "photo",
            capturedAt: "2026-02-18T09:00:00",
          },
        ],
      },
      {
        id: "log-photo-2",
        spaceId: "plants",
        kind: "routine-run",
        title: "Weekly feed completed",
        note: "Fed the plant and logged a proof shot.",
        occurredAt: "2026-03-02T09:00:00",
        routineId: "routine-plant-feed",
        assetIds: ["asset-monstera"],
        attachmentsCount: 1,
        attachments: [
          {
            id: "attachment-photo-2",
            uri: "file://photo-2.jpg",
            mediaType: "photo",
            capturedAt: "2026-03-02T09:05:00",
          },
        ],
      },
      {
        id: "log-photo-3",
        spaceId: "reef",
        kind: "asset-update",
        title: "Filter housing cleaned",
        note: "Shared one maintenance photo for the filter.",
        occurredAt: "2026-03-05T07:30:00",
        assetIds: ["asset-filter"],
        attachmentsCount: 1,
        attachments: [
          {
            id: "attachment-photo-3",
            uri: "file://photo-3.jpg",
            mediaType: "photo",
            capturedAt: "2026-03-05T07:30:00",
          },
        ],
      },
    ],
  });

  const plantsHistory = buildWorkspaceVisualHistory(snapshot, {
    spaceId: "plants",
  });
  assert.equal(plantsHistory.photoCount, 2);
  assert.equal(plantsHistory.proofCount, 1);
  assert.equal(plantsHistory.assetGalleries[0].id, "asset-monstera");
  assert.equal(plantsHistory.monthlyRecaps.length, 2);
  assert.equal(plantsHistory.beforeAfter?.before.logId, "log-photo-1");
  assert.equal(plantsHistory.beforeAfter?.after.logId, "log-photo-2");

  const filterHistory = buildWorkspaceVisualHistory(snapshot, {
    assetId: "asset-filter",
  });
  assert.equal(filterHistory.photoCount, 1);
  assert.equal(filterHistory.beforeAfter, null);
});

test("visual recap cover selections reorder recap spotlight items", () => {
  const history = buildWorkspaceVisualHistory(trackItUpWorkspace, {
    spaceId: "plants",
  });
  const recap = history.monthlyRecaps[0];

  assert.ok(recap);
  assert.ok(recap.items.length >= 2);

  const scope = { spaceId: "plants" };
  const selectedPhotoId = recap.items[1].id;
  const keyedHistory = applyVisualRecapCoverSelections(history, scope, {
    [getVisualRecapCoverSelectionKey(scope, recap.monthKey)]: selectedPhotoId,
  });

  assert.equal(keyedHistory.monthlyRecaps[0].coverPhotoId, selectedPhotoId);
  assert.equal(keyedHistory.monthlyRecaps[0].items[0].id, selectedPhotoId);
  assert.equal(
    keyedHistory.monthlyRecaps[0].highlightUris[0],
    keyedHistory.monthlyRecaps[0].coverUri,
  );
});

test("notification response intent distinguishes default and action buttons", () => {
  const responseBase = {
    notification: {
      request: {
        content: {
          data: {
            source: "trackitup-reminder",
            route: "action-center",
            reminderId: "reminder-1",
            spaceId: "reef",
          },
        },
        identifier: "notification-1",
      },
    },
  };

  assert.deepEqual(
    getReminderNotificationResponseIntent({
      ...responseBase,
      actionIdentifier: REMINDER_NOTIFICATION_DEFAULT_ACTION_ID,
    }),
    {
      kind: "default",
      reminderId: "reminder-1",
      route: "action-center",
      spaceId: "reef",
    },
  );

  assert.deepEqual(
    getReminderNotificationResponseIntent({
      ...responseBase,
      actionIdentifier: REMINDER_NOTIFICATION_COMPLETE_ACTION_ID,
    }),
    {
      kind: "complete",
      reminderId: "reminder-1",
      route: "action-center",
      spaceId: "reef",
    },
  );

  assert.deepEqual(
    getReminderNotificationResponseIntent({
      ...responseBase,
      actionIdentifier: REMINDER_NOTIFICATION_SKIP_ACTION_ID,
    }),
    {
      kind: "skip",
      reminderId: "reminder-1",
      route: "action-center",
      spaceId: "reef",
    },
  );
});

test("recurring notification response intent distinguishes default and action buttons", () => {
  const responseBase = {
    notification: {
      request: {
        content: {
          data: {
            source: "trackitup-recurring",
            route: "action-center",
            occurrenceId: "occ-1",
            planId: "plan-1",
            spaceId: "reef",
          },
        },
        identifier: "notification-2",
      },
    },
  };

  assert.deepEqual(
    getRecurringNotificationResponseIntent({
      ...responseBase,
      actionIdentifier: RECURRING_NOTIFICATION_DEFAULT_ACTION_ID,
    }),
    {
      kind: "default",
      occurrenceId: "occ-1",
      planId: "plan-1",
      route: "action-center",
      spaceId: "reef",
    },
  );

  assert.deepEqual(
    getRecurringNotificationResponseIntent({
      ...responseBase,
      actionIdentifier: RECURRING_NOTIFICATION_COMPLETE_ACTION_ID,
    }),
    {
      kind: "complete",
      occurrenceId: "occ-1",
      planId: "plan-1",
      route: "action-center",
      spaceId: "reef",
    },
  );

  assert.deepEqual(
    getRecurringNotificationResponseIntent({
      ...responseBase,
      actionIdentifier: RECURRING_NOTIFICATION_SKIP_ACTION_ID,
    }),
    {
      kind: "skip",
      occurrenceId: "occ-1",
      planId: "plan-1",
      route: "action-center",
      spaceId: "reef",
    },
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

test("routine-run quick action template exposes proof photo capture", () => {
  const template = getQuickActionFormTemplate("routine-run");
  const attachmentField = template.sections[1].fields.find(
    (field) => field.id === "attachments",
  );

  assert.ok(attachmentField);
  assert.equal(attachmentField?.type, "media");
  assert.match(attachmentField?.label ?? "", /proof photo/i);
});

test("reminder log template exposes proof photo capture", () => {
  const template = getLogKindFormTemplate("reminder");
  const attachmentField = template.sections[0].fields.find(
    (field) => field.id === "attachments",
  );

  assert.ok(attachmentField);
  assert.equal(attachmentField?.type, "media");
  assert.match(attachmentField?.label ?? "", /proof photo/i);
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

test("workspace spaces helper supports custom categories and humanized summaries", () => {
  const snapshot = createEmptyWorkspaceSnapshot("2026-03-10T12:00:00.000Z");
  const result = createWorkspaceSpace(
    snapshot,
    { name: "Home Office", category: "  home office  " },
    "2026-03-10T13:00:00.000Z",
  );

  assert.equal(result.status, "created");
  assert.equal(result.space?.category, "home office");
  assert.match(result.space?.themeColor ?? "", /^#/);
  assert.equal(getSpaceSummaries(result.workspace)[0]?.category, "Home Office");

  const invalidCategory = createWorkspaceSpace(snapshot, {
    name: "Closet",
    category: "   ",
  });
  assert.equal(invalidCategory.status, "invalid");
  assert.match(invalidCategory.message, /category/i);
});

test("workspace spaces helper updates existing spaces and preserves id", () => {
  const snapshot = createSnapshot({
    spaces: [
      {
        id: "reef-tank",
        name: "Reef Tank",
        category: "aquarium",
        status: "stable",
        themeColor: "#0f766e",
        summary: "Existing summary",
        createdAt: "2026-03-09T12:00:00.000Z",
      },
    ],
  });

  const result = updateWorkspaceSpace(
    snapshot,
    "reef-tank",
    {
      name: "Display Reef",
      category: "home maintenance",
      summary: "Updated summary",
      status: "watch",
    },
    "2026-03-10T14:00:00.000Z",
  );

  assert.equal(result.status, "updated");
  assert.equal(result.space?.id, "reef-tank");
  assert.equal(result.space?.name, "Display Reef");
  assert.equal(result.space?.category, "home-maintenance");
  assert.equal(result.space?.summary, "Updated summary");
  assert.equal(result.space?.status, "watch");
  assert.equal(result.workspace.generatedAt, "2026-03-10T14:00:00.000Z");
});

test("workspace spaces helper archives spaces and selectors exclude archived by default", () => {
  const snapshot = createSnapshot({
    spaces: [
      {
        id: "reef-tank",
        name: "Reef Tank",
        category: "aquarium",
        status: "stable",
        themeColor: "#0f766e",
        summary: "Existing summary",
        createdAt: "2026-03-09T12:00:00.000Z",
      },
    ],
  });

  const archived = archiveWorkspaceSpace(
    snapshot,
    "reef-tank",
    "2026-03-10T15:00:00.000Z",
  );

  assert.equal(archived.status, "archived");
  assert.equal(archived.workspace.spaces[0]?.status, "archived");
  assert.equal(getSpaceSummaries(archived.workspace).length, 0);
  assert.equal(getOverviewStats(archived.workspace)[0]?.value, "0");
});

test("space creation suggestions map template categories into workspace categories", () => {
  assert.equal(mapTemplateCategoryToSpaceCategory("Aquarium"), "aquarium");
  assert.equal(mapTemplateCategoryToSpaceCategory("Gardening"), "gardening");
  assert.equal(
    mapTemplateCategoryToSpaceCategory("Vehicle Maintenance"),
    "vehicle-maintenance",
  );
  assert.equal(mapTemplateCategoryToSpaceCategory("Pet care"), "pets");
  assert.equal(mapTemplateCategoryToSpaceCategory("DIY workshop"), "workshop");
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

test("workspace logs helper updates editable fields and preserves log identity", () => {
  const snapshot = createSnapshot({
    logs: [
      {
        id: "log-edit-1",
        spaceId: "reef",
        kind: "asset-update",
        title: "Original title",
        note: "Original note",
        occurredAt: "2026-03-09T10:00:00.000Z",
        tags: ["reef"],
      },
    ],
  });

  const result = updateWorkspaceLog(
    snapshot,
    "log-edit-1",
    {
      title: "Updated title",
      note: "Updated note",
      tags: ["reef", "maintenance"],
    },
    "2026-03-10T10:00:00.000Z",
  );

  assert.equal(result.status, "updated");
  assert.equal(result.log?.id, "log-edit-1");
  assert.equal(result.log?.title, "Updated title");
  assert.equal(result.log?.note, "Updated note");
  assert.deepEqual(result.log?.tags, ["reef", "maintenance"]);
  assert.equal(result.workspace.generatedAt, "2026-03-10T10:00:00.000Z");
});

test("workspace logs helper archives entries and timeline excludes archived logs", () => {
  const snapshot = createSnapshot({
    logs: [
      {
        id: "log-keep",
        spaceId: "reef",
        kind: "asset-update",
        title: "Keep me",
        note: "Still active",
        occurredAt: "2026-03-09T10:00:00.000Z",
      },
      {
        id: "log-hide",
        spaceId: "reef",
        kind: "asset-update",
        title: "Archive me",
        note: "Should disappear from timeline",
        occurredAt: "2026-03-09T11:00:00.000Z",
      },
    ],
  });

  const archived = archiveWorkspaceLog(
    snapshot,
    "log-hide",
    "2026-03-10T11:00:00.000Z",
  );

  assert.equal(archived.status, "archived");
  assert.equal(archived.log?.archivedAt, "2026-03-10T11:00:00.000Z");

  const timeline = buildTimelineEntriesFromLogs(
    archived.workspace.logs,
    archived.workspace.spaces,
    archived.workspace.generatedAt,
  );
  assert.equal(
    timeline.some((item) => item.id === "log-hide"),
    false,
  );
  assert.equal(
    timeline.some((item) => item.id === "log-keep"),
    true,
  );
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
  assert.equal(DEFAULT_THEME_ACCENT_COLOR, "#1a73e8");
  assert.equal(normalizeThemePreference("light"), "light");
  assert.equal(normalizeThemePreference("dark"), "dark");
  assert.equal(normalizeThemePreference("oled"), "oled");
  assert.equal(normalizeThemePreference("monotone-light"), "monotone-light");
  assert.equal(normalizeThemePreference("monotone-dark"), "monotone-dark");
  assert.equal(normalizeThemePreference("system"), "dark");
  assert.equal(normalizeThemeAccentColor("#abc"), "#aabbcc");
  assert.equal(normalizeThemeAccentColor("7C3AED"), "#7c3aed");
  assert.equal(normalizeThemeAccentColor("banana"), "#1a73e8");
  assert.equal(getThemeAccentLabel("#10b981"), "Emerald");
  assert.equal(getThemeAccentLabel("#7c3aed"), "Custom");
  assert.equal(isDarkThemePreference("light"), false);
  assert.equal(isDarkThemePreference("dark"), true);
  assert.equal(isDarkThemePreference("oled"), true);
  assert.equal(isDarkThemePreference("monotone-light"), false);
  assert.equal(isDarkThemePreference("monotone-dark"), true);
  assert.equal(getThemeBackgroundColor("light"), "#f8fafc");
  assert.equal(getThemeBackgroundColor("dark"), "#111318");
  assert.equal(getThemeBackgroundColor("oled"), "#000000");
  assert.equal(getThemeBackgroundColor("monotone-light"), "#ffffff");
  assert.equal(getThemeBackgroundColor("monotone-dark"), "#0b0b0b");
});

test("ai preferences default to privacy-first prompt history and normalize BYOK input", () => {
  assert.equal(DEFAULT_AI_PROMPT_HISTORY_ENABLED, false);
  assert.equal(normalizeAiPromptHistoryEnabled(true), true);
  assert.equal(normalizeAiPromptHistoryEnabled("true"), true);
  assert.equal(normalizeAiPromptHistoryEnabled("false"), false);
  assert.equal(normalizeAiPromptHistoryEnabled(null), false);
  assert.equal(normalizeOpenRouterApiKey("  sk-or-v1-demo  "), "sk-or-v1-demo");
  assert.equal(normalizeOpenRouterApiKey("   "), null);
  assert.equal(normalizeOpenRouterApiKey(undefined), null);
});

test("ai client helpers normalize model, bounds, and headers safely", () => {
  assert.equal(
    normalizeOpenRouterTextModel("  google/gemini-2.5-flash  "),
    "google/gemini-2.5-flash",
  );
  assert.equal(normalizeOpenRouterTextModel("   "), "openai/gpt-4.1-mini");

  const normalized = normalizeOpenRouterTextGenerationOptions({
    prompt: "  Draft a concise summary.  ",
    model: "",
    user: "  demo-user  ",
    temperature: 3,
    maxOutputTokens: 10_000,
    timeoutMs: 1_000,
    headers: { "HTTP-Referer": "https://trackitup.app", Empty: "" },
  });

  assert.equal(normalized.prompt, "Draft a concise summary.");
  assert.equal(normalized.model, "openai/gpt-4.1-mini");
  assert.equal(normalized.user, "demo-user");
  assert.equal(normalized.temperature, 2);
  assert.equal(normalized.maxOutputTokens, 4096);
  assert.equal(normalized.timeoutMs, 5000);
  assert.deepEqual(normalized.headers, {
    "X-Title": "TrackItUp",
    "HTTP-Referer": "https://trackitup.app",
  });

  const defaults = normalizeOpenRouterTextGenerationOptions({
    prompt: "go",
  });
  assert.equal(defaults.maxOutputTokens, DEFAULT_AI_MAX_OUTPUT_TOKENS);
  assert.equal(defaults.timeoutMs, DEFAULT_AI_TIMEOUT_MS);
});

test("openrouter model helpers group free and paid text models safely", () => {
  const normalizedModels = normalizeOpenRouterSelectableModels([
    {
      id: "  free/model  ",
      name: " Free Model ",
      description: " Free-tier text model ",
      context_length: 8192,
      pricing: { prompt: "0", completion: "0" },
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    },
    {
      id: "paid/model",
      name: "Paid Model",
      pricing: { prompt: "0.000001", completion: "0.000002" },
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    },
    {
      id: "image/model",
      name: "Image Model",
      pricing: { prompt: "0", completion: "0" },
      architecture: {
        input_modalities: ["image"],
        output_modalities: ["image"],
      },
    },
  ]);

  assert.deepEqual(
    normalizedModels.map((model) => [model.id, model.tier]),
    [
      ["free/model", "free"],
      ["paid/model", "paid"],
    ],
  );
  assert.equal(normalizedModels[0].name, "Free Model");
  assert.equal(normalizedModels[0].description, "Free-tier text model");
  assert.equal(formatOpenRouterModelPricingLabel(normalizedModels[0]), "Free");
  assert.match(
    formatOpenRouterModelPricingLabel(normalizedModels[1]),
    /Input \$1\.00\/M • Output \$2\.00\/M/,
  );
  assert.equal(
    classifyOpenRouterModelTier({ pricing: { prompt: "0", completion: "0" } }),
    "free",
  );
  assert.equal(
    classifyOpenRouterModelTier({
      pricing: { prompt: "0.000001", completion: "0.000002" },
    }),
    "paid",
  );
  assert.equal(
    supportsOpenRouterTextModel({
      id: "text/model",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    }),
    true,
  );
  assert.equal(
    supportsOpenRouterTextModel({
      id: "audio/model",
      architecture: {
        input_modalities: ["audio"],
        output_modalities: ["audio"],
      },
    }),
    false,
  );
});

test("openrouter model helpers filter, sort, and pick a sensible default tier", () => {
  const models = [
    {
      id: "free/compact",
      name: "Compact Free",
      description: "Fast starter model",
      createdAt: 1_700_000_000,
      contextLength: 4096,
      pricing: { prompt: "0", completion: "0" },
      tier: "free",
    },
    {
      id: "paid/cheap",
      name: "Affordable Paid",
      description: "Budget paid model",
      createdAt: 1_720_000_000,
      contextLength: 16000,
      pricing: { prompt: "0.000001", completion: "0.000001" },
      tier: "paid",
    },
    {
      id: "paid/large-context",
      name: "Large Context",
      description: "High-context paid model",
      createdAt: 1_710_000_000,
      contextLength: 128000,
      pricing: { prompt: "0.000005", completion: "0.000007" },
      tier: "paid",
    },
  ];

  assert.deepEqual(
    filterOpenRouterSelectableModels(models, "budget").map((model) => model.id),
    ["paid/cheap"],
  );
  assert.deepEqual(
    filterOpenRouterSelectableModels(models, "compact").map(
      (model) => model.id,
    ),
    ["free/compact"],
  );
  assert.deepEqual(
    sortOpenRouterSelectableModels(models, "context-length").map(
      (model) => model.id,
    ),
    ["paid/large-context", "paid/cheap", "free/compact"],
  );
  assert.deepEqual(
    sortOpenRouterSelectableModels(models, "price").map((model) => model.id),
    ["free/compact", "paid/cheap", "paid/large-context"],
  );
  assert.deepEqual(
    sortOpenRouterSelectableModels(models, "release-date").map(
      (model) => model.id,
    ),
    ["paid/cheap", "paid/large-context", "free/compact"],
  );
  assert.equal(getDefaultOpenRouterModelTier(models, "paid/cheap"), "paid");
  assert.equal(getDefaultOpenRouterModelTier(models, "missing/model"), "free");
  assert.equal(
    formatOpenRouterModelPricingLabel({
      tier: "paid",
      pricing: { prompt: "0.000001", completion: undefined },
    }),
    "Input $1.00/M",
  );
});

test("openrouter model helpers normalize saved sorts and split search highlights", () => {
  assert.equal(DEFAULT_OPENROUTER_MODEL_SORT, "recommended");
  assert.equal(normalizeOpenRouterModelSort("price"), "price");
  assert.equal(normalizeOpenRouterModelSort("release-date"), "release-date");
  assert.equal(
    normalizeOpenRouterModelSort("context-length"),
    "context-length",
  );
  assert.equal(normalizeOpenRouterModelSort("unknown"), "recommended");
  assert.deepEqual(getOpenRouterSearchHighlightParts("Compact Free", "free"), [
    { text: "Compact ", isHighlighted: false },
    { text: "Free", isHighlighted: true },
  ]);
  assert.deepEqual(getOpenRouterSearchHighlightParts("GPT GPT", "gpt"), [
    { text: "GPT", isHighlighted: true },
    { text: " ", isHighlighted: false },
    { text: "GPT", isHighlighted: true },
  ]);
  assert.deepEqual(getOpenRouterSearchHighlightParts("No Match", ""), [
    { text: "No Match", isHighlighted: false },
  ]);
});

test("ai client helpers preserve useful error messages", () => {
  assert.deepEqual(
    buildTrackItUpAiHeaders({ Custom: "value", Empty: undefined }),
    {
      "X-Title": "TrackItUp",
      Custom: "value",
    },
  );
  assert.equal(
    formatAiServiceError(new Error("Provider refused request")),
    "Provider refused request",
  );
  assert.match(
    formatAiServiceError({ detail: true }),
    /failed before TrackItUp received/i,
  );
});

test("schema-builder prompt uses compact template and workspace context", () => {
  const draft = buildSchemaBuilderPrompt({
    workspace: trackItUpWorkspace,
    userGoal:
      "Create a reef maintenance template with chemistry readings, photo proof, and follow-up reminders.",
    quickActionKind: "metric-entry",
  });

  assert.equal(draft.context.feature, "schema-builder");
  assert.equal(draft.context.quickActionKind, "metric-entry");
  assert.ok(draft.context.baseTemplate.sections.length > 0);
  assert.ok(
    draft.context.presetFields.some(
      (field) => field.label === "Observation note",
    ),
  );
  assert.match(draft.prompt, /Base schema family: metric-entry/);
  assert.match(draft.consentLabel, /template, space, and metric metadata/i);
  assert.doesNotMatch(draft.prompt, /syncQueue|lastSyncAt|lastSyncError/);
});

test("logbook prompt keeps only the minimum necessary related context", () => {
  const snapshot = createSnapshot({
    logs: [
      {
        id: "ai-log-target",
        spaceId: "reef",
        kind: "asset-update",
        title: "Skimmer cup cleaned",
        note: "Pulled thick waste and reset the cup after the weekly check.",
        occurredAt: "2026-03-10T09:00:00.000Z",
        assetIds: ["asset-filter"],
        tags: ["maintenance", "reef"],
        attachments: [
          {
            id: "attach-proof",
            uri: "file://proof-photo.jpg",
            mediaType: "photo",
            capturedAt: "2026-03-10T09:00:00.000Z",
          },
        ],
        locationPoint: { latitude: 12.3, longitude: 45.6 },
        customFieldValues: { secret: "hidden" },
      },
      {
        id: "ai-log-other-space",
        spaceId: "plants",
        kind: "asset-update",
        title: "Repotted pothos",
        note: "Fresh soil and moss pole.",
        occurredAt: "2026-03-11T09:00:00.000Z",
      },
    ],
  });

  const draft = buildLogbookDraftPrompt({
    workspace: snapshot,
    userRequest: "Rewrite this into a cleaner entry and suggest tags.",
    draftNote: "Cleaned the skimmer cup and checked flow after feeding.",
    spaceId: "reef",
    assetIds: ["asset-filter"],
  });

  assert.equal(draft.context.feature, "logbook-draft");
  assert.equal(draft.context.targetSpace?.name, "100G Reef Tank");
  assert.equal(draft.context.selectedAssets[0]?.name, "Canister Filter");
  assert.equal(draft.context.recentLogs.length, 1);
  assert.equal(draft.context.recentLogs[0]?.title, "Skimmer cup cleaned");
  assert.doesNotMatch(
    draft.prompt,
    /file:\/\/proof-photo\.jpg|locationPoint|customFieldValues/,
  );
});

test("visual recap prompt summarizes highlights without sending photo URIs", () => {
  const draft = buildVisualRecapPrompt({
    workspace: trackItUpWorkspace,
    scope: { spaceId: "plants" },
    scopeLabel: "Plants",
  });

  assert.ok(draft);
  assert.equal(draft?.context.feature, "visual-recap");
  assert.equal(draft?.context.scopeLabel, "Plants");
  assert.ok((draft?.context.highlights.length ?? 0) > 0);
  assert.match(
    draft?.system ?? "",
    /Do not claim to have directly seen photos/i,
  );
  assert.doesNotMatch(draft?.prompt ?? "", /file:\/\//);
});

test("planner copilot prompt uses compact reminder and recommendation context", () => {
  const activeDateKey =
    trackItUpWorkspace.reminders[0]?.dueAt.slice(0, 10) ??
    trackItUpWorkspace.generatedAt.slice(0, 10);
  const draft = buildPlannerCopilotPrompt({
    workspace: trackItUpWorkspace,
    userRequest:
      "Prioritize the selected day and tell me what needs proof first.",
    activeDateKey,
  });

  assert.equal(draft.context.feature, "planner-copilot");
  assert.equal(draft.context.activeDateKey, activeDateKey);
  assert.ok(draft.context.upcomingAgenda.length > 0);
  assert.match(draft.prompt, /Selected planner day/);
});

test("planner risk prompt uses compact deferral and hotspot context", () => {
  const activeDateKey =
    trackItUpWorkspace.reminders[0]?.dueAt.slice(0, 10) ??
    trackItUpWorkspace.generatedAt.slice(0, 10);
  const snapshot = createSnapshot({
    reminders: trackItUpWorkspace.reminders.map((reminder, index) =>
      index === 0
        ? {
            ...reminder,
            status: "snoozed",
            history: [
              ...(reminder.history ?? []),
              {
                id: "planner-risk-history-1",
                action: "snoozed",
                at: "2026-03-12T08:00:00.000Z",
                note: "Pushed because the filter inspection took longer.",
              },
              {
                id: "planner-risk-history-2",
                action: "skipped",
                at: "2026-03-11T08:00:00.000Z",
                note: "Skipped while supplies were being restocked.",
              },
            ],
          }
        : reminder,
    ),
  });

  const riskSummary = buildWorkspacePlannerRiskSummary(snapshot, activeDateKey);
  const draft = buildPlannerRiskPrompt({
    workspace: snapshot,
    userRequest: "Explain what is most likely to slip and what can wait.",
    activeDateKey,
  });

  assert.equal(draft.context.feature, "planner-risk-brief");
  assert.ok(riskSummary.highestRiskReminders.length > 0);
  assert.ok(draft.context.retrievedSources.length > 0);
  assert.match(draft.prompt, /Selected planner day/);
});

test("action center explainer prompt includes grouped workload and next steps", () => {
  const draft = buildActionCenterExplainerPrompt({
    workspace: trackItUpWorkspace,
    userRequest:
      "Explain the queue pressure and tell me what should be handled first.",
  });

  assert.equal(draft.context.feature, "action-center-explainer");
  assert.ok(draft.context.nextBestSteps.length > 0);
  assert.ok(draft.context.groupedBySpace.length > 0);
  assert.equal(
    typeof draft.context.nextBestSteps[0].recentDeferralCount,
    "number",
  );
  assert.equal(
    typeof draft.context.nextBestSteps[0].recentCompletionCount,
    "number",
  );
  assert.equal(typeof draft.context.nextBestSteps[0].priorityScore, "number");
  assert.equal(
    typeof draft.context.nextBestSteps[0].isRecurringLike,
    "boolean",
  );
  assert.match(draft.prompt, /grouped workload/i);
  assert.match(draft.prompt, /ordered by actionability/i);
  assert.match(
    draft.prompt,
    /complete-now, log-proof, snooze, open-planner, create-log, create-recurring-plan, complete-recurring-now, review-later/i,
  );
});

test("tracking quality prompt uses compact evidence-gap context", () => {
  const snapshot = createSnapshot({
    logs: [
      {
        id: "quality-log-sparse",
        spaceId: "reef",
        kind: "routine-run",
        title: "Quick cleanup",
        note: "Done",
        occurredAt: "2026-03-10T09:00:00.000Z",
        attachmentsCount: 0,
      },
      ...trackItUpWorkspace.logs,
    ],
    reminders: trackItUpWorkspace.reminders.map((reminder, index) =>
      index === 0
        ? {
            ...reminder,
            history: [
              ...(reminder.history ?? []),
              {
                id: "quality-history-1",
                action: "snoozed",
                at: "2026-03-11T07:30:00.000Z",
                note: "Deferred until proof can be logged.",
              },
            ],
          }
        : reminder,
    ),
  });

  const summary = buildWorkspaceTrackingQualitySummary(snapshot);
  const draft = buildTrackingQualityPrompt({
    workspace: snapshot,
    userRequest:
      "Explain what I should record next to improve tracking quality.",
  });

  assert.equal(draft.context.feature, "tracking-quality-brief");
  assert.ok(summary.reminderGaps.length > 0 || summary.sparseLogs.length > 0);
  assert.ok(draft.context.retrievedSources.length > 0);
  assert.match(draft.prompt, /what should be recorded next/i);
});

test("workspace q&a prompt selects compact grounded sources only", () => {
  const snapshot = createSnapshot({
    logs: [
      {
        id: "qa-log-filter",
        spaceId: "reef",
        kind: "asset-update",
        title: "Filter intake cleaned",
        note: "Rinsed the intake guard and restored full flow after algae buildup.",
        occurredAt: "2026-03-10T09:00:00.000Z",
        assetIds: ["asset-filter"],
        tags: ["filter", "maintenance"],
        attachments: [
          {
            id: "qa-photo",
            uri: "file://reef-filter.jpg",
            mediaType: "photo",
            capturedAt: "2026-03-10T09:05:00.000Z",
          },
        ],
        locationPoint: { latitude: 10.2, longitude: 12.3 },
        customFieldValues: { hidden: "secret" },
      },
    ],
  });

  const draft = buildWorkspaceQaPrompt({
    workspace: snapshot,
    question: "What does TrackItUp know about recent filter maintenance?",
  });

  assert.equal(draft.context.feature, "workspace-q-and-a");
  assert.ok(draft.context.retrievedSources.length > 0);
  assert.ok(
    draft.context.retrievedSources.some((source) =>
      /Canister Filter|Filter intake cleaned/.test(source.title),
    ),
  );
  assert.doesNotMatch(
    draft.prompt,
    /file:\/\/reef-filter\.jpg|locationPoint|customFieldValues/,
  );
});

test("ai draft review helpers compact values and summarize token usage", () => {
  assert.equal(formatAiDraftReviewValue(true), "Yes");
  assert.equal(formatAiDraftReviewValue(false), "No");
  assert.equal(
    formatAiDraftReviewValue("  Rewrite   this into a cleaner summary.  "),
    "Rewrite this into a cleaner summary.",
  );
  assert.equal(formatAiDraftReviewValue(null), null);
  assert.match(
    formatAiDraftReviewValue({ title: "Schema draft", fields: 4 }) ?? "",
    /Schema draft/,
  );
  assert.equal(
    formatAiDraftUsageLabel({ inputTokens: 120, outputTokens: 48 }),
    "120 in • 48 out",
  );
  assert.equal(formatAiDraftUsageLabel({ totalTokens: 240 }), "240 total");
});

test("ai draft review helpers build compact review items for lists and fields", () => {
  const reviewItems = buildAiDraftReviewItems([
    { key: "title", label: "Title", value: "  Reef maintenance draft  " },
    {
      key: "tags",
      label: "Suggested tags",
      value: ["reef", "maintenance", "chemistry", "weekly"],
      maxLines: 3,
    },
    { key: "empty", label: "Ignore", value: "   " },
  ]);

  assert.equal(reviewItems.length, 2);
  assert.equal(reviewItems[0].valueText, "Reef maintenance draft");
  assert.deepEqual(reviewItems[1].valueLines, [
    "reef",
    "maintenance",
    "chemistry",
    "+1 more",
  ]);
});

test("ai text input helpers compact transcript preview and source labels", () => {
  assert.equal(DEFAULT_AI_TRANSCRIPT_PREVIEW_MAX_LENGTH, 160);
  assert.equal(
    compactAiTranscriptPreview(
      "  rewrite   the skimmer note into a cleaner summary  ",
    ),
    "rewrite the skimmer note into a cleaner summary",
  );
  assert.equal(compactAiTranscriptPreview("   "), null);
  assert.equal(
    getAiTranscriptSourceLabel("speech-recognition"),
    "Live transcript",
  );
  assert.equal(
    getAiTranscriptSourceLabel("device-keyboard"),
    "Keyboard dictation",
  );
  assert.equal(getAiTranscriptSourceLabel(undefined), null);
});

test("ai text input helpers derive prompt state labels safely", () => {
  assert.equal(getAiPromptCharacterCountLabel(""), "Prompt empty");
  assert.equal(getAiPromptCharacterCountLabel(" reef "), "4 chars");
  assert.equal(canSubmitAiPrompt("Draft a recap"), true);
  assert.equal(canSubmitAiPrompt("   "), false);
  assert.equal(canSubmitAiPrompt("Draft a recap", true), false);
});

test("ai schema draft parser extracts reviewable local template drafts", () => {
  const rawResponse = `Here is the draft:\n\n\`\`\`json
  {
    "name": "Reef maintenance check",
    "summary": "Track chemistry, observations, and proof from weekly reef maintenance.",
    "category": "Aquarium",
    "quickActionKind": "metric-entry",
    "extraFields": [
      {
        "label": "Observation note",
        "type": "rich-text",
        "description": "Main maintenance observations.",
        "placeholder": "What changed?"
      },
      {
        "label": "Reference asset",
        "type": "checklist",
        "source": "assets",
        "required": true
      },
      {
        "label": "Reference asset",
        "type": "checklist",
        "source": "assets"
      },
      {
        "label": "Ignored source field",
        "type": "textarea",
        "source": "metrics"
      }
    ]
  }
  \`\`\``;

  const parsed = parseAiSchemaTemplateDraft(rawResponse, "quick-log");
  assert.ok(parsed);
  assert.equal(parsed?.quickActionKind, "metric-entry");
  assert.equal(parsed?.name, "Reef maintenance check");
  assert.equal(parsed?.extraFields.length, 3);
  assert.equal(parsed?.extraFields[1]?.source, "assets");
  assert.equal(parsed?.extraFields[2]?.source, undefined);

  const reviewItems = buildAiSchemaDraftReviewItems(parsed);
  assert.equal(reviewItems[0].label, "Template name");
  assert.match(reviewItems.at(-1)?.value?.join(" ") ?? "", /Observation note/);
  assert.match(
    buildAiSchemaGenerationPrompt("Base prompt"),
    /Return ONLY valid JSON/,
  );
});

test("ai logbook draft parser extracts grounded writing suggestions", () => {
  const rawResponse = [
    "Draft suggestion:",
    "```json",
    JSON.stringify(
      {
        title: "Weekly reef check completed",
        note: "Completed the skimmer clean, checked flow, and confirmed parameters were stable after feeding.",
        tags: ["reef", "maintenance", "reef", "weekly-check"],
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  const parsed = parseAiLogbookDraft(rawResponse, {
    allowTitle: true,
    allowTags: true,
  });

  assert.ok(parsed);
  assert.equal(parsed?.title, "Weekly reef check completed");
  assert.match(parsed?.note ?? "", /confirmed parameters were stable/i);
  assert.deepEqual(parsed?.tags, ["reef", "maintenance", "weekly-check"]);

  const reviewItems = buildAiLogbookDraftReviewItems(parsed ?? {});
  assert.equal(reviewItems[0]?.label, "Title");
  assert.match(reviewItems.at(-1)?.value?.join(" ") ?? "", /weekly-check/);
  assert.match(
    buildAiLogbookGenerationPrompt("Base prompt", {
      allowTitle: true,
      allowTags: false,
    }),
    /Only include keys shown above/,
  );
});

test("ai visual recap parser extracts grounded narrator drafts", () => {
  const rawResponse = [
    "Narration draft:",
    "```json",
    JSON.stringify(
      {
        headline: "Plants showed steady recovery this month",
        summary:
          "The selected recap points to steady plant recovery, repeated proof captures, and consistent check-ins recorded through TrackItUp logs.",
        highlights: [
          "Proof photos captured multiple milestones across the month.",
          "Recent logs emphasized maintenance consistency and gradual progress.",
          "Proof photos captured multiple milestones across the month.",
        ],
        nextFocus:
          "Keep the same cadence next month so changes remain easy to compare.",
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  const parsed = parseAiVisualRecapDraft(rawResponse);
  assert.ok(parsed);
  assert.equal(parsed?.headline, "Plants showed steady recovery this month");
  assert.match(parsed?.summary ?? "", /steady plant recovery/i);
  assert.equal(parsed?.highlights.length, 2);
  assert.match(parsed?.nextFocus ?? "", /same cadence next month/i);

  const reviewItems = buildAiVisualRecapReviewItems(
    parsed ?? { headline: "", highlights: [] },
  );
  assert.equal(reviewItems[0]?.label, "Headline");
  assert.match(reviewItems.at(-1)?.value ?? "", /next month/i);
  assert.match(
    buildAiVisualRecapGenerationPrompt("Base prompt"),
    /Do not imply direct visual inspection/i,
  );
});

test("ai planner copilot parser extracts reviewable next-step drafts", () => {
  const reminders = trackItUpWorkspace.reminders
    .slice(0, 2)
    .map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
    }));
  const activeDateKey =
    trackItUpWorkspace.reminders[0]?.dueAt.slice(0, 10) ??
    trackItUpWorkspace.generatedAt.slice(0, 10);
  const rawResponse = [
    "Planner draft:",
    "```json",
    JSON.stringify(
      {
        headline: "Focus proof capture first, then clear the shorter reminders",
        summary:
          "The selected day appears manageable if proof capture happens first and lower-friction reminders are handled before anything that might slip.",
        focusDateKey: activeDateKey,
        groupedPlan: [
          "Handle the reminder that needs proof capture first.",
          "Use the action center for anything that still needs triage after that.",
        ],
        suggestedActions: [
          {
            reminderId: reminders[0]?.id,
            title: reminders[0]?.title,
            action: "log-proof",
            reason:
              "This one benefits most from recording completion evidence immediately.",
          },
          {
            reminderId: "missing-reminder",
            title: "Ignore",
            action: "do-now",
            reason: "Should be dropped.",
          },
        ],
        caution: "Review anything overdue before snoozing it.",
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  const parsed = parseAiPlannerCopilotDraft(rawResponse, {
    allowedDateKeys: [activeDateKey],
    reminders,
  });

  assert.ok(parsed);
  assert.equal(parsed?.focusDateKey, activeDateKey);
  assert.equal(parsed?.suggestedActions.length, 1);
  assert.match(parsed?.summary ?? "", /proof capture happens first/i);

  const reviewItems = buildAiPlannerCopilotReviewItems(
    parsed ?? { headline: "", groupedPlan: [], suggestedActions: [] },
  );
  assert.equal(reviewItems[0]?.label, "Headline");
  assert.match(
    buildAiPlannerCopilotGenerationPrompt("Base prompt"),
    /review-only next-step suggestion/i,
  );
});

test("ai planner risk parser extracts cited reviewable risk briefs", () => {
  const rawResponse = [
    "Planner risk brief:",
    "```json",
    JSON.stringify(
      {
        headline: "Repeated deferrals make the reef queue the main risk",
        summary:
          "The reef reminder queue looks likeliest to slip because one selected-day reminder was recently snoozed and skipped while that same space still carries open pressure.",
        keyRisks: [
          "One selected-day reminder has multiple recent deferrals.",
          "The same space still holds open planner pressure.",
        ],
        sourceIds: [
          "reminder:reminder-water-change",
          "deferral:planner-risk-history-1",
          "space:reef",
          "unknown-source",
        ],
        suggestedDestination: "action-center",
        caution:
          "Use the cited reminder history before deciding to snooze anything again.",
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  const sources = [
    {
      id: "reminder:reminder-water-change",
      title: "Water change",
      kind: "reminder",
      snippet: "Already overdue and recently deferred.",
      route: "action-center",
      spaceId: "reef",
      reminderId: "reminder-water-change",
    },
    {
      id: "deferral:planner-risk-history-1",
      title: "Water change (snoozed)",
      kind: "deferral",
      snippet: "Pushed because the filter inspection took longer.",
      route: "action-center",
      spaceId: "reef",
      reminderId: "reminder-water-change",
    },
    {
      id: "space:reef",
      title: "100G Reef Tank",
      kind: "space",
      snippet: "1 overdue, 0 due today, 2 recent deferrals.",
      route: "action-center",
      spaceId: "reef",
    },
  ];

  const parsed = parseAiPlannerRiskDraft(rawResponse, {
    allowedSourceIds: sources.map((source) => source.id),
  });

  assert.ok(parsed);
  assert.deepEqual(parsed?.citedSourceIds, [
    "reminder:reminder-water-change",
    "deferral:planner-risk-history-1",
    "space:reef",
  ]);
  assert.equal(parsed?.suggestedDestination, "action-center");
  assert.match(parsed?.summary ?? "", /likeliest to slip/i);

  const reviewItems = buildAiPlannerRiskReviewItems(parsed, sources);
  assert.match(reviewItems[3]?.value?.join(" ") ?? "", /Reminder:/i);
  assert.match(
    buildAiPlannerRiskGenerationPrompt("Base prompt"),
    /Cite 1 to 4 sourceIds/i,
  );
});

test("ai tracking quality parser extracts cited reviewable briefs", () => {
  const rawResponse = [
    "Tracking quality brief:",
    "```json",
    JSON.stringify(
      {
        headline: "Record reef proof and a fresh chemistry reading next",
        summary:
          "The reef space is the clearest tracking-quality gap because an open reminder still lacks a linked proof log, recent space activity includes a sparse cleanup note, and a tracked metric needs fresher coverage.",
        keyGaps: [
          "One open reminder still lacks a linked proof log.",
          "A recent cleanup entry was saved without enough detail or proof.",
        ],
        sourceIds: [
          "reminder:reminder-water-change",
          "metric:metric-salinity",
          "log:quality-log-sparse",
          "unknown-source",
        ],
        suggestedDestination: "logbook",
        caution:
          "Check the cited reminder and metric context before deciding which quick log to record first.",
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  const sources = [
    {
      id: "reminder:reminder-water-change",
      title: "Water change",
      kind: "reminder-gap",
      snippet: "No linked proof log was recorded recently.",
      route: "logbook",
      spaceId: "reef",
      reminderId: "reminder-water-change",
      actionId: "quick-log",
    },
    {
      id: "metric:metric-salinity",
      title: "Salinity",
      kind: "metric-gap",
      snippet: "Its last recorded reading is older than 30 days.",
      route: "logbook",
      spaceId: "reef",
      actionId: "quick-metric",
    },
    {
      id: "log:quality-log-sparse",
      title: "Quick cleanup",
      kind: "log-gap",
      snippet: "The note is too short and no proof attachment was saved.",
      route: "logbook",
      spaceId: "reef",
      actionId: "quick-log",
    },
  ];

  const parsed = parseAiTrackingQualityDraft(rawResponse, {
    allowedSourceIds: sources.map((source) => source.id),
  });

  assert.ok(parsed);
  assert.deepEqual(parsed?.citedSourceIds, [
    "reminder:reminder-water-change",
    "metric:metric-salinity",
    "log:quality-log-sparse",
  ]);
  assert.equal(parsed?.suggestedDestination, "logbook");
  assert.match(parsed?.summary ?? "", /tracking-quality gap/i);

  const reviewItems = buildAiTrackingQualityReviewItems(parsed, sources);
  assert.match(reviewItems[3]?.value?.join(" ") ?? "", /Reminder gap:/i);
  assert.match(
    buildAiTrackingQualityGenerationPrompt("Base prompt"),
    /what should be recorded next/i,
  );
});

test("ai action center explainer parser extracts grounded queue guidance", () => {
  const reminders = trackItUpWorkspace.reminders
    .slice(0, 2)
    .map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
    }));
  const rawResponse = [
    "Action center explainer:",
    "```json",
    JSON.stringify(
      {
        headline:
          "Handle the overdue queue first, then reduce pressure in the busiest space",
        summary:
          "Most urgency sits in reminders that are already overdue, while one space is carrying enough open work to keep the queue noisy if it is not reduced soon.",
        groupedInsights: [
          "One space is carrying a larger share of open reminders than the others.",
          "Overdue reminders should be resolved before the due-today queue grows.",
        ],
        recommendationTakeaways: [
          "Use the logbook when proof capture will close a reminder cleanly.",
        ],
        suggestedActions: [
          {
            reminderId: reminders[0]?.id,
            title: reminders[0]?.title,
            action: "complete-now",
            reason:
              "This one is already overdue and is the clearest item to remove from the queue first.",
          },
          {
            action: "create-log",
            title: "Capture a quick progress note",
            reason:
              "A lightweight log can capture current state before the next queue pass.",
            formValues: {
              occurredAt: "2026-03-09T20:30:00.000Z",
              note: "Captured from transcript with explicit timestamp.",
              tags: ["ai", "transcript"],
            },
          },
          {
            reminderId: "missing-reminder",
            title: "Ignore",
            action: "open-planner",
            reason: "Should be dropped.",
          },
        ],
        caution: "Review anything recently snoozed before deferring it again.",
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  const parsed = parseAiActionCenterExplainerDraft(rawResponse, {
    reminders,
  });

  assert.ok(parsed);
  assert.equal(parsed?.suggestedActions.length, 2);
  assert.equal(parsed?.groupedInsights.length, 2);
  assert.match(parsed?.summary ?? "", /Most urgency sits/i);
  assert.equal(
    parsed?.suggestedActions.find((item) => item.action === "create-log")
      ?.formValues?.occurredAt,
    "2026-03-09T20:30:00.000Z",
  );

  const reviewItems = buildAiActionCenterExplainerReviewItems(
    parsed ?? {
      headline: "",
      groupedInsights: [],
      recommendationTakeaways: [],
      suggestedActions: [],
    },
  );
  assert.equal(reviewItems[0]?.label, "Headline");
  assert.match(
    buildAiActionCenterExplainerGenerationPrompt("Base prompt"),
    /review-only explanation/i,
  );
});

test("ai action plan helpers build transparent steps and execute approved actions", () => {
  const reminder = trackItUpWorkspace.reminders[0];
  const recurringOccurrence = trackItUpWorkspace.recurringOccurrences.find(
    (item) => item.status === "scheduled",
  );
  assert.ok(reminder);
  assert.ok(recurringOccurrence);

  const draft = {
    headline: "Queue needs triage",
    summary: "Handle the most urgent item first.",
    groupedInsights: [],
    recommendationTakeaways: [],
    suggestedActions: [
      {
        reminderId: reminder.id,
        title: reminder.title,
        action: "complete-now",
        reason: "Most urgent in the queue.",
      },
      {
        reminderId: reminder.id,
        title: reminder.title,
        action: "open-planner",
        reason: "Review broader planner pressure.",
      },
      {
        title: "Create a quick log",
        action: "create-log",
        reason: "Capture a brief status note now.",
        formValues: {
          occurredAt: "2026-03-10T08:31:00.000Z",
          note: "Follow-up chemistry check complete.",
          tags: ["reef", "ai"],
        },
      },
      {
        title: "Create recurring plan",
        action: "create-recurring-plan",
        reason: "Set up a recurring cadence for this workflow.",
        formValues: {
          startDate: "2026-03-11T09:00:00.000Z",
          timezone: "UTC",
          scheduleType: "weekly",
          scheduleTimes: ["09:00"],
          daysOfWeek: [1, 3],
        },
      },
      {
        recurringOccurrenceId: recurringOccurrence?.id,
        recurringPlanId: recurringOccurrence?.planId,
        title: "Complete recurring run",
        action: "complete-recurring-now",
        reason: "Current occurrence can be marked complete now.",
      },
    ],
  };

  const plan = buildAiActionPlanFromActionCenterDraft({
    draft,
    request: "Handle my queue",
    consentLabel: "Only compact reminder context was shared.",
    modelId: "demo/model",
    usage: { inputTokens: 100, outputTokens: 50 },
    workspace: trackItUpWorkspace,
  });

  assert.equal(plan.surface, "action-center-explainer");
  assert.equal(plan.steps.length, 5);
  assert.equal(plan.steps[0].approved, true);
  assert.match(plan.transcript.interpretedIntentSummary, /Queue needs triage/i);

  const partiallyApprovedPlan = setAiActionPlanStepApproved(
    plan,
    plan.steps[1].id,
    false,
  );
  assert.equal(partiallyApprovedPlan.steps[1].approved, false);
  assert.equal(partiallyApprovedPlan.status, "partially-approved");

  const completedReminderIds = [];
  const completedRecurringIds = [];
  const createdArtifacts = [];
  const openedRoutes = [];
  const createLogPayloads = [];
  const createRecurringPayloads = [];
  const result = executeAiActionPlan(
    partiallyApprovedPlan,
    trackItUpWorkspace,
    {
      completeReminder: (id) => completedReminderIds.push(id),
      snoozeReminder: () => {},
      completeRecurringOccurrence: (id) => completedRecurringIds.push(id),
      openPlanner: () => openedRoutes.push("planner"),
      createLog: (payload) => {
        createdArtifacts.push("quick-log");
        createLogPayloads.push(payload);
      },
      createRecurringPlan: (payload) => {
        createdArtifacts.push("recurring-plan");
        createRecurringPayloads.push(payload);
      },
      openReminderLogbook: () => openedRoutes.push("logbook"),
    },
  );

  assert.equal(result.executedCount, 4);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.failedCount, 0);
  assert.deepEqual(completedReminderIds, [reminder.id]);
  assert.deepEqual(completedRecurringIds, [recurringOccurrence?.id]);
  assert.deepEqual(createdArtifacts, ["quick-log", "recurring-plan"]);
  assert.equal(createLogPayloads[0]?.title, "Create a quick log");
  assert.equal(
    createLogPayloads[0]?.formValues?.occurredAt,
    "2026-03-10T08:31:00.000Z",
  );
  assert.equal(createRecurringPayloads[0]?.title, "Create recurring plan");
  assert.equal(createRecurringPayloads[0]?.formValues?.scheduleType, "weekly");
  assert.deepEqual(openedRoutes, []);
  assert.equal(result.updatedPlan.status, "executed");
});

test("ai workspace q&a parser extracts cited grounded answers", () => {
  const sources = [
    {
      id: "asset:asset-filter",
      kind: "asset",
      title: "Canister Filter",
      snippet: "filter • maintenance • 100G Reef Tank",
      route: "inventory",
    },
    {
      id: "log:qa-log-filter",
      kind: "log",
      title: "Filter intake cleaned",
      snippet: "asset-update • 2026-03-10 • restored full flow",
      route: "logbook",
    },
  ];
  const rawResponse = [
    "Workspace answer:",
    "```json",
    JSON.stringify(
      {
        headline: "Recent filter maintenance looks straightforward",
        answer:
          "The strongest grounded evidence points to a recent intake cleaning that restored flow, with the filter asset still active in the reef setup.",
        keyPoints: [
          "A recent log records an intake cleaning and restored flow.",
          "The tracked asset remains active in the reef workspace.",
        ],
        sourceIds: ["log:qa-log-filter", "asset:asset-filter", "missing"],
        suggestedDestination: "inventory",
        caution:
          "Open the logbook if you need more detailed proof or chronology.",
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  const parsed = parseAiWorkspaceQaDraft(rawResponse, {
    allowedSourceIds: sources.map((source) => source.id),
  });

  assert.ok(parsed);
  assert.deepEqual(parsed?.citedSourceIds, [
    "log:qa-log-filter",
    "asset:asset-filter",
  ]);
  assert.equal(parsed?.suggestedDestination, "inventory");
  assert.match(parsed?.answer ?? "", /restored flow/i);

  const reviewItems = buildAiWorkspaceQaReviewItems(parsed, sources);
  assert.equal(reviewItems[0]?.label, "Headline");
  assert.match(
    reviewItems[3]?.value?.join(" ") ?? "",
    /Asset: Canister Filter/i,
  );
  assert.match(
    buildAiWorkspaceQaGenerationPrompt("Base prompt"),
    /Cite 1 to 4 sourceIds/i,
  );
});

test("dashboard pulse helpers build compact grounded home context", () => {
  const snapshot = createSnapshot({
    generatedAt: "2026-03-20T10:00:00.000Z",
    logs: [
      ...trackItUpWorkspace.logs,
      {
        id: "dashboard-pulse-metric",
        spaceId: "reef",
        kind: "metric-reading",
        title: "Salinity dip",
        note: "Salinity fell after a top-off issue.",
        occurredAt: "2026-03-19T09:00:00.000Z",
        assetIds: ["asset-filter"],
        tags: ["reef", "salinity"],
        metricReadings: [{ metricId: "metric-salinity", value: 1.02 }],
        attachments: [
          {
            id: "dashboard-pulse-photo",
            uri: "file://reef-dashboard.jpg",
            mediaType: "photo",
            capturedAt: "2026-03-19T09:00:00.000Z",
          },
        ],
      },
    ],
  });

  const pulse = buildWorkspaceDashboardPulse(snapshot);
  const promptDraft = buildDashboardPulsePrompt({
    workspace: snapshot,
    userRequest: "Summarize what needs attention first across the dashboard.",
  });

  assert.ok(pulse.attentionItems.length > 0);
  assert.ok(pulse.activeSpaces.length > 0);
  assert.ok(promptDraft.context.retrievedSources.length > 0);
  assert.ok(
    promptDraft.context.retrievedSources.some((source) =>
      /safe zone|follow-up|pending task/i.test(
        `${source.title} ${source.snippet}`,
      ),
    ),
  );
  assert.doesNotMatch(promptDraft.prompt, /file:\/\//i);
});

test("ai dashboard pulse parser extracts cited dashboard briefs", () => {
  const sources = [
    {
      id: "recommendation:rec-reef",
      title: "Review reef maintenance follow-up",
      kind: "recommendation",
      snippet:
        "A due reef reminder and recent evidence suggest a planner review.",
      route: "planner",
      spaceId: "reef",
    },
    {
      id: "attention:metric-alert:dashboard-pulse-metric:metric-salinity",
      title: "Salinity is outside the safe zone",
      kind: "attention",
      snippet: "1.02 SG in 100G Reef Tank",
      route: "planner",
      spaceId: "reef",
    },
  ];
  const rawResponse = [
    "Dashboard pulse:",
    "```json",
    JSON.stringify(
      {
        headline: "Reef follow-up leads the dashboard today",
        summary:
          "The dashboard evidence points to reef follow-up first because a safe-range alert and an open maintenance recommendation both converge on the same area.",
        priorities: [
          "Check the reef planner items tied to the recent salinity dip.",
          "Review the recommendation before logging any follow-up action.",
        ],
        sourceIds: [
          "attention:metric-alert:dashboard-pulse-metric:metric-salinity",
          "recommendation:rec-reef",
          "unknown-source",
        ],
        suggestedDestination: "planner",
        caution:
          "Use the cited planner items and logs to confirm the cause before acting.",
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  const parsed = parseAiDashboardPulseDraft(rawResponse, {
    allowedSourceIds: sources.map((source) => source.id),
  });

  assert.ok(parsed);
  assert.deepEqual(parsed?.citedSourceIds, [
    "attention:metric-alert:dashboard-pulse-metric:metric-salinity",
    "recommendation:rec-reef",
  ]);
  assert.equal(parsed?.suggestedDestination, "planner");
  assert.match(parsed?.summary ?? "", /dashboard evidence points/i);

  const reviewItems = buildAiDashboardPulseReviewItems(parsed, sources);
  assert.match(reviewItems[3]?.value?.join(" ") ?? "", /Recommendation:/i);
  assert.match(
    buildAiDashboardPulseGenerationPrompt("Base prompt"),
    /Cite 1 to 4 sourceIds/i,
  );
});

test("inventory lifecycle helpers summarize asset pressure without raw attachment leakage", () => {
  const snapshot = createSnapshot({
    generatedAt: "2026-03-20T10:00:00.000Z",
    assets: [
      {
        id: "asset-filter",
        spaceId: "reef",
        name: "Canister Filter",
        category: "Equipment",
        status: "maintenance",
        note: "Needs a service review.",
        purchaseDate: "2025-03-10",
        purchasePrice: 180,
        warrantyExpiresAt: "2026-03-25T00:00:00.000Z",
        warrantyNote: "1-year coverage",
      },
      {
        id: "asset-airpump",
        spaceId: "reef",
        name: "Backup Air Pump",
        category: "Equipment",
        status: "active",
        note: "Stored for outages.",
        purchaseDate: "2025-09-01",
        purchasePrice: 65,
      },
    ],
    expenses: [
      {
        id: "expense-filter-service",
        spaceId: "reef",
        title: "Filter media",
        category: "maintenance",
        amount: 42,
        currency: "USD",
        occurredAt: "2026-03-05T09:00:00.000Z",
        assetId: "asset-filter",
      },
      {
        id: "expense-airpump",
        spaceId: "reef",
        title: "Air pump",
        category: "equipment",
        amount: 65,
        currency: "USD",
        occurredAt: "2025-09-01T09:00:00.000Z",
        assetId: "asset-airpump",
      },
    ],
    logs: [
      {
        id: "inventory-asset-log",
        spaceId: "reef",
        kind: "asset-update",
        title: "Filter servicing",
        note: "Captured proof after cleaning the housing.",
        occurredAt: "2026-03-10T09:00:00.000Z",
        assetIds: ["asset-filter"],
        tags: ["maintenance"],
        attachments: [
          {
            id: "inventory-photo",
            uri: "file://inventory-proof.jpg",
            mediaType: "photo",
            capturedAt: "2026-03-10T09:00:00.000Z",
          },
        ],
      },
    ],
  });

  const lifecycle = buildWorkspaceInventoryLifecycleSummary(snapshot);
  const promptDraft = buildInventoryLifecyclePrompt({
    workspace: snapshot,
    userRequest: "Which assets need documentation or warranty review next?",
  });

  assert.equal(lifecycle.summary.warrantyRiskCount, 1);
  assert.ok(
    lifecycle.attentionAssets.some((asset) => asset.id === "asset-filter"),
  );
  assert.ok(
    lifecycle.attentionAssets.some((asset) => asset.id === "asset-airpump"),
  );
  assert.ok(promptDraft.context.retrievedSources.length > 0);
  assert.ok(
    promptDraft.context.retrievedSources.some((source) =>
      /warranty|maintenance|photo history/i.test(
        `${source.title} ${source.snippet}`,
      ),
    ),
  );
  assert.match(
    aiInventoryLifecycleCopy.helperText,
    /asset lifecycle pressure/i,
  );
  assert.doesNotMatch(promptDraft.prompt, /file:\/\//i);
});

test("ai inventory lifecycle parser extracts grounded asset briefs", () => {
  const sources = [
    {
      id: "asset:asset-filter",
      title: "Canister Filter",
      kind: "asset",
      snippet: "Maintenance status; warranty expires within 30 days.",
      route: "inventory",
      assetId: "asset-filter",
      spaceId: "reef",
    },
    {
      id: "asset:asset-airpump",
      title: "Backup Air Pump",
      kind: "asset",
      snippet: "No linked logs or photo history recorded yet.",
      route: "logbook",
      assetId: "asset-airpump",
      spaceId: "reef",
    },
  ];
  const rawResponse = [
    "Inventory lifecycle:",
    "```json",
    JSON.stringify(
      {
        headline: "Documentation gaps matter more than raw asset count today",
        summary:
          "The strongest grounded inventory signal is that one asset is already in maintenance with near-term warranty pressure, while another still lacks any linked documentation trail.",
        priorities: [
          "Review the filter record before the warranty window closes.",
          "Open logbook and capture a first asset update for the backup air pump.",
        ],
        sourceIds: ["asset:asset-airpump", "asset:asset-filter", "missing"],
        suggestedDestination: "logbook",
        caution:
          "Check the cited asset cards before recording new maintenance or proof.",
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  const parsed = parseAiInventoryLifecycleDraft(rawResponse, {
    allowedSourceIds: sources.map((source) => source.id),
  });

  assert.ok(parsed);
  assert.deepEqual(parsed?.citedSourceIds, [
    "asset:asset-airpump",
    "asset:asset-filter",
  ]);
  assert.equal(parsed?.suggestedDestination, "logbook");
  assert.match(parsed?.summary ?? "", /grounded inventory signal/i);

  const reviewItems = buildAiInventoryLifecycleReviewItems(parsed, sources);
  assert.match(
    reviewItems[3]?.value?.join(" ") ?? "",
    /Asset: Backup Air Pump/i,
  );
  assert.match(
    buildAiInventoryLifecycleGenerationPrompt("Base prompt"),
    /Cite 1 to 4 sourceIds/i,
  );
});

test("cross-space trend helpers compare months and keep sources grounded", () => {
  const snapshot = createSnapshot({
    generatedAt: "2026-03-18T10:00:00.000Z",
    logs: [
      {
        id: "trend-feb-proof",
        spaceId: "reef",
        kind: "routine-run",
        title: "February reef proof",
        note: "Captured a healthy coral spread after cleanup.",
        occurredAt: "2026-02-12T10:00:00.000Z",
        assetIds: ["asset-filter"],
        tags: ["reef", "proof"],
        routineId: "routine-water-change",
        attachments: [
          {
            id: "trend-feb-photo-1",
            uri: "file://reef-feb-1.jpg",
            mediaType: "photo",
            capturedAt: "2026-02-12T10:00:00.000Z",
          },
          {
            id: "trend-feb-photo-2",
            uri: "file://reef-feb-2.jpg",
            mediaType: "photo",
            capturedAt: "2026-02-12T10:01:00.000Z",
          },
        ],
      },
      {
        id: "trend-mar-metric",
        spaceId: "reef",
        kind: "metric-reading",
        title: "March salinity alert",
        note: "Salinity dipped after a top-off issue.",
        occurredAt: "2026-03-10T09:00:00.000Z",
        assetIds: ["asset-filter"],
        tags: ["reef", "salinity"],
        metricReadings: [
          {
            metricId: "metric-salinity",
            value: 30,
          },
        ],
        attachments: [
          {
            id: "trend-mar-photo",
            uri: "file://reef-mar.jpg",
            mediaType: "photo",
            capturedAt: "2026-03-10T09:00:00.000Z",
          },
        ],
      },
    ],
  });

  const trendSummary = buildWorkspaceTrendSummary(snapshot, "2026-03");
  const promptDraft = buildCrossSpaceTrendPrompt({
    workspace: snapshot,
    monthKey: "2026-03",
    userRequest:
      "Explain the strongest month-over-month changes and anomalies across spaces.",
  });

  assert.equal(trendSummary.previousMonthKey, "2026-02");
  assert.ok(trendSummary.anomalies.length > 0);
  assert.ok(
    promptDraft.context.retrievedSources.some((source) =>
      /salinity|activity dropped|overdue/i.test(
        `${source.title} ${source.snippet}`,
      ),
    ),
  );
  assert.doesNotMatch(promptDraft.prompt, /file:\/\//i);
});

test("ai cross-space trend parser extracts cited anomaly summaries", () => {
  const sources = [
    {
      id: "space:reef",
      title: "100G Reef Tank",
      kind: "space",
      snippet: "1 photo in 2026-03 vs 2 in 2026-02; 1 metric alert.",
      route: "planner",
      spaceId: "reef",
    },
    {
      id: "anomaly:metric-alert:reef:metric-salinity:trend-mar-metric",
      title: "100G Reef Tank: Salinity is outside the safe zone",
      kind: "anomaly",
      snippet: "30 ppt was logged in 2026-03, outside the safe range.",
      route: "planner",
      spaceId: "reef",
    },
  ];
  const rawResponse = [
    "Trend summary:",
    "```json",
    JSON.stringify(
      {
        headline: "Reef follow-up stands out this month",
        summary:
          "Across spaces, the reef setup shows the clearest anomaly because salinity dropped below the safe range while documented proof activity also softened versus the prior month.",
        keySignals: [
          "A March salinity reading is outside the safe range.",
          "The reef space logged fewer March photos than in February.",
        ],
        sourceIds: [
          "anomaly:metric-alert:reef:metric-salinity:trend-mar-metric",
          "space:reef",
          "missing-source",
        ],
        suggestedDestination: "planner",
        caution:
          "Review the reef planner and recent logs before assuming the cause of the salinity dip.",
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  const parsed = parseAiCrossSpaceTrendDraft(rawResponse, {
    allowedSourceIds: sources.map((source) => source.id),
  });

  assert.ok(parsed);
  assert.deepEqual(parsed?.citedSourceIds, [
    "anomaly:metric-alert:reef:metric-salinity:trend-mar-metric",
    "space:reef",
  ]);
  assert.equal(parsed?.suggestedDestination, "planner");
  assert.match(parsed?.summary ?? "", /salinity dropped/i);

  const reviewItems = buildAiCrossSpaceTrendReviewItems(parsed, sources);
  assert.match(reviewItems[3]?.value?.join(" ") ?? "", /Anomaly:/i);
  assert.match(
    buildAiCrossSpaceTrendGenerationPrompt("Base prompt"),
    /Cite 1 to 4 sourceIds/i,
  );
});

test("ai consent copy stays surface-specific and privacy-forward", () => {
  assert.match(
    aiSchemaBuilderCopy.getHelperText("Metric entry"),
    /Metric entry/,
  );
  assert.match(aiSchemaBuilderCopy.consentLabel, /not sent/i);
  assert.match(aiLogbookDraftCopy.consentLabel, /Attachments, photo URIs/i);
  assert.match(
    aiVisualRecapCopy.getHelperText("Plants", "March 2026"),
    /Plants.*March 2026/i,
  );
  assert.match(
    aiVisualRecapCopy.reviewFooterNote,
    /sharing it outside TrackItUp/i,
  );
  assert.match(aiPlannerCopilotCopy.consentLabel, /reminder schedule/i);
  assert.match(aiPlannerRiskCopy.consentLabel, /recent snooze\/skip history/i);
  assert.match(aiTrackingQualityCopy.consentLabel, /recent logs/i);
  assert.match(aiActionCenterExplainerCopy.consentLabel, /grouped reminders/i);
  assert.match(
    aiWorkspaceQaCopy.consentLabel,
    /matching local reminders, logs, assets/i,
  );
  assert.match(aiDashboardPulseCopy.consentLabel, /dashboard counts/i);
  assert.match(
    aiCrossSpaceTrendCopy.consentLabel,
    /month-over-month workspace counts/i,
  );
  assert.match(
    aiAccountSettingsCopy.telemetrySummary,
    /not stored in telemetry/i,
  );
});

test("ai telemetry summary aggregates local generation and apply events", () => {
  let summary = createEmptyAiTelemetrySummary();
  summary = applyAiTelemetryEvent(summary, {
    surface: "schema-builder",
    action: "generate-requested",
    at: "2026-03-11T10:00:00.000Z",
  });
  summary = applyAiTelemetryEvent(summary, {
    surface: "schema-builder",
    action: "generate-succeeded",
    at: "2026-03-11T10:00:05.000Z",
  });
  summary = applyAiTelemetryEvent(summary, {
    surface: "schema-builder",
    action: "draft-applied",
    at: "2026-03-11T10:01:00.000Z",
  });
  summary = applyAiTelemetryEvent(summary, {
    surface: "action-center-explainer",
    action: "generate-requested",
    at: "2026-03-11T10:02:00.000Z",
  });
  summary = applyAiTelemetryEvent(summary, {
    surface: "workspace-q-and-a",
    action: "generate-succeeded",
    at: "2026-03-11T10:03:00.000Z",
  });
  summary = applyAiTelemetryEvent(summary, {
    surface: "planner-risk-brief",
    action: "generate-requested",
    at: "2026-03-11T10:03:15.000Z",
  });
  summary = applyAiTelemetryEvent(summary, {
    surface: "tracking-quality-brief",
    action: "generate-requested",
    at: "2026-03-11T10:03:20.000Z",
  });
  summary = applyAiTelemetryEvent(summary, {
    surface: "dashboard-pulse",
    action: "generate-requested",
    at: "2026-03-11T10:03:30.000Z",
  });
  summary = applyAiTelemetryEvent(summary, {
    surface: "inventory-lifecycle-brief",
    action: "generate-requested",
    at: "2026-03-11T10:03:40.000Z",
  });
  summary = applyAiTelemetryEvent(summary, {
    surface: "cross-space-trends",
    action: "generate-requested",
    at: "2026-03-11T10:04:00.000Z",
  });

  assert.equal(summary.totalEvents, 10);
  assert.equal(summary.generationRequests, 7);
  assert.equal(summary.generationSuccesses, 2);
  assert.equal(summary.draftApplies, 1);
  assert.equal(summary.surfaces["schema-builder"].draftApplies, 1);
  assert.equal(
    summary.surfaces["action-center-explainer"].generationRequests,
    1,
  );
  assert.equal(summary.surfaces["workspace-q-and-a"].generationSuccesses, 1);
  assert.equal(summary.surfaces["planner-risk-brief"].generationRequests, 1);
  assert.equal(
    summary.surfaces["tracking-quality-brief"].generationRequests,
    1,
  );
  assert.equal(summary.surfaces["dashboard-pulse"].generationRequests, 1);
  assert.equal(
    summary.surfaces["inventory-lifecycle-brief"].generationRequests,
    1,
  );
  assert.equal(summary.surfaces["cross-space-trends"].generationRequests, 1);
  assert.deepEqual(Object.keys(summary.surfaces), [...AI_TELEMETRY_SURFACES]);
  assert.ok(
    AI_TELEMETRY_WORKFLOW_SURFACE_CHIPS.some(
      (item) => item.surface === "inventory-lifecycle-brief",
    ),
  );
  assert.ok(
    AI_TELEMETRY_WORKFLOW_SURFACE_CHIPS.some(
      (item) => item.surface === "tracking-quality-brief",
    ),
  );
  assert.match(
    formatAiTelemetryLastEventLabel(summary.lastEventAt),
    /Last AI activity/i,
  );
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
  assert.equal(normalized.dashboardWidgets.length, 4);
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
