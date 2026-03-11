export const aiSchemaBuilderCopy = {
  getHelperText(baseFamilyLabel: string) {
    return `The current base family is ${baseFamilyLabel}. Describe the hobby workflow, fields, and proof you want to capture.`;
  },
  consentLabel:
    "TrackItUp sends your request plus a compact slice of template, space, and metric metadata to your chosen model. Full workspace snapshots, attachments, and unrelated history are not sent.",
  promptFooterNote:
    "AI prepares a draft for review only. Applying it updates this builder, but nothing is saved until you tap Save template.",
  reviewFooterNote:
    "Apply the draft to copy its template name, summary, category, base family, and suggested fields into the editable builder below.",
};

export const aiLogbookDraftCopy = {
  helperText:
    "Describe how you want the current title, notes, or tags improved. Keep the request grounded in what actually happened.",
  consentLabel:
    "TrackItUp sends your request plus a compact slice of the current draft, related space, asset, reminder, routine, and recent log metadata to your chosen model. Attachments, photo URIs, precise locations, and full workspace snapshots are not sent.",
  promptFooterNote:
    "AI prepares a draft for review only. Applying it updates the editable log form below, but nothing is saved until you record the entry.",
  reviewFooterNote:
    "Apply the draft to copy the suggested title, notes, and tags into the current form. Review the result before saving.",
};

export const aiVisualRecapCopy = {
  getHelperText(scopeLabel: string, monthLabel: string) {
    return `TrackItUp will summarize ${scopeLabel} for ${monthLabel} using recap metadata and linked log text only.`;
  },
  consentLabel:
    "TrackItUp sends the selected recap's counts, highlight log summaries, and your request to your chosen model. Photo files, photo URIs, and unselected history are not sent.",
  promptFooterNote:
    "AI prepares a recap draft for review only. Applying it shows the narration in this gallery view, but does not change your saved logs or exported PDFs.",
  reviewFooterNote:
    "Apply the recap to show it in this visual history view. Review the wording carefully before sharing it outside TrackItUp.",
};

export const aiPlannerCopilotCopy = {
  getHelperText(activeDateKey: string) {
    return `TrackItUp will use the selected planner day, reminder calendar, action-center summary, and current recommendations to suggest the next best moves for ${activeDateKey}.`;
  },
  consentLabel:
    "TrackItUp sends your request plus a compact slice of reminder schedule, selected day agenda, recent reminder activity, and recommendations to your chosen model. Full logs, attachments, and unrelated workspace history are not sent.",
  promptFooterNote:
    "AI prepares a plan draft for review only. Applying it focuses this planner view and shows suggested next actions, but does not complete, snooze, skip, or create reminders.",
  reviewFooterNote:
    "Apply the plan to focus the suggested day and show the recommended next actions in the planner. Review it before acting on any reminder.",
};

export const aiPlannerRiskCopy = {
  getHelperText(activeDateKey: string) {
    return `TrackItUp will analyze planner risk for ${activeDateKey} using open reminders, recent snoozes/skips, and grouped space pressure only.`;
  },
  consentLabel:
    "TrackItUp sends your request plus a compact slice of open reminder timing, selected-day workload, recent snooze/skip history, and grouped space pressure to your chosen model. Full logs, attachments, and unrelated workspace history are not sent.",
  promptFooterNote:
    "AI prepares a review-only risk brief. Applying it pins the summary in planner, but does not snooze, skip, complete, or log proof automatically.",
  reviewFooterNote:
    "Apply the brief only after checking that the cited reminders, deferrals, and space hotspots support it. Use the linked destination before changing any reminder state.",
};

export const aiActionCenterExplainerCopy = {
  helperText:
    "TrackItUp will explain the current reminder queue using overdue, due-today, grouped workload, recent reminder activity, and recommendation context only.",
  consentLabel:
    "TrackItUp sends your request plus a compact slice of action-center counts, grouped reminders, recent reminder activity, and current recommendations to your chosen model. Full workspace snapshots, attachments, and unrelated log history are not sent.",
  promptFooterNote:
    "AI prepares a review-only explanation of the queue. Applying it shows the explainer and suggested next moves, but does not complete, snooze, skip, or create reminders.",
  reviewFooterNote:
    "Apply the explainer to pin the summary and suggested next moves in the action center. Review each suggestion before taking any reminder action.",
};

export const aiTrackingQualityCopy = {
  helperText:
    "TrackItUp will analyze tracking quality using recent logs, missing proof or notes, stale metric coverage, and open reminder pressure only.",
  consentLabel:
    "TrackItUp sends your request plus a compact slice of recent logs, reminder-linked evidence gaps, stale metric coverage, and grouped space tracking pressure to your chosen model. Full attachments, raw media, and unrelated workspace history are not sent.",
  promptFooterNote:
    "AI prepares a review-only tracking quality brief. Applying it pins the summary in action center, but does not create logs, complete reminders, or modify workspace data automatically.",
  reviewFooterNote:
    "Apply the brief only after checking that the cited reminders, logs, metrics, and spaces support it. Use the linked destination to record the missing detail manually.",
};

export const aiInventoryLifecycleCopy = {
  helperText:
    "TrackItUp will analyze asset lifecycle pressure using tracked assets, ownership cost, warranty timing, linked logs, photo proof, and inventory recommendations only.",
  consentLabel:
    "TrackItUp sends your request plus a compact slice of tracked asset status, ownership cost, warranty timing, linked log/photo coverage, and inventory recommendations to your chosen model. Raw attachment files, full log payloads, and unrelated workspace history are not sent.",
  promptFooterNote:
    "AI prepares a review-only inventory lifecycle brief. Applying it pins the summary in inventory, but does not edit assets, create logs, or change warranty records automatically.",
  reviewFooterNote:
    "Apply the brief only after checking that the cited assets and recommendations support it. Use the linked destination before recording or reviewing anything else.",
};

export const aiScannerAssistantCopy = {
  getHelperText(scanKindLabel: string) {
    return `TrackItUp will use the current ${scanKindLabel.toLowerCase()} result plus a compact slice of matched asset, template, and recent log metadata to suggest the safest next step.`;
  },
  consentLabel:
    "TrackItUp sends your request plus the scanned code, scan type, and a compact slice of matched asset, template, space, and recent log metadata to your chosen model. Camera frames, photo files, and full workspace snapshots are not sent.",
  promptFooterNote:
    "AI prepares a review-only scanner suggestion. Applying it pins the recommended next step here, but does not save logs, import templates, or change workspace data automatically.",
  reviewFooterNote:
    "Apply the draft to pin the suggested destination and optional quick-log outline inside the scanner so you can act on it manually.",
};

export const aiWorkspaceQaCopy = {
  helperText:
    "TrackItUp will retrieve a compact set of local workspace sources that best match your question, then ask AI to answer only from that grounded context.",
  consentLabel:
    "TrackItUp sends your question plus a compact slice of matching local reminders, logs, assets, templates, recommendations, and workspace counts to your chosen model. Full workspace snapshots, attachment URIs, raw photos, and precise location payloads are not sent.",
  promptFooterNote:
    "AI prepares a review-only answer draft. Applying it pins the answer and cited sources in the action center, but does not change reminders, logs, or inventory automatically.",
  reviewFooterNote:
    "Apply the answer only after checking that the cited sources really support it. If the sources are weak, ask a narrower question or navigate to the linked workflow directly.",
};

export const aiDashboardPulseCopy = {
  helperText:
    "TrackItUp will send only a compact dashboard overview, top attention items, active spaces, and recommendation snippets to AI for a grounded pulse brief.",
  consentLabel:
    "TrackItUp sends your request plus compact dashboard counts, selected recommendation snippets, attention items, and active space summaries to your chosen model. Full logs, attachment URIs, and raw inventory payloads are not sent.",
  promptFooterNote:
    "AI prepares a review-only pulse brief. Applying it pins the summary on the dashboard, but does not change reminders, logs, inventory, or widgets automatically.",
  reviewFooterNote:
    "Apply the pulse brief only after checking that the cited recommendations, attention items, and spaces support it. If the brief feels weak, ask for a narrower dashboard question or open the linked workflow directly.",
};

export const aiCrossSpaceTrendCopy = {
  helperText:
    "TrackItUp will compare the selected month against the prior month, then send only compact cross-space counts, alerts, and anomalies to AI for a grounded trend summary.",
  consentLabel:
    "TrackItUp sends your request plus compact month-over-month workspace counts, selected cross-space anomalies, reminder pressure, and safe-range metric alerts to your chosen model. Full photo libraries, attachment URIs, and raw log payloads are not sent.",
  promptFooterNote:
    "AI prepares a review-only trend summary. Applying it pins the summary and cited sources in visual history, but does not change reminders, logs, or inventory automatically.",
  reviewFooterNote:
    "Apply the summary only after checking that the cited spaces and anomalies support it. If the explanation feels weak, narrow the question or inspect the linked space history directly.",
};

export const aiAccountSettingsCopy = {
  title: "AI key, privacy, and local telemetry",
  intro:
    "TrackItUp's AI features use your own OpenRouter key. When secure device storage is available, the key stays on this device and is never included in workspace sync payloads.",
  privacySummary:
    "Each AI surface sends only the minimum template, draft, reminder, or recap slice needed for the action you choose.",
  modelSelectionSummary:
    "Pick the default OpenRouter model TrackItUp should use for new AI requests on this device. The model catalog is fetched directly from OpenRouter and grouped into free and paid options.",
  modelSelectionDefault:
    "Free models are shown first in the picker. Your selection stays local to this device unless a workflow explicitly asks for another model.",
  promptHistoryDefault:
    "Default posture: don't save AI prompt history during the MVP unless you explicitly opt in on this device.",
  keyReplacementNote:
    "Saved keys are not shown back in the UI. Enter a new key to replace the existing one on this device.",
  secureStorageUnavailable:
    "Secure key storage is unavailable in this environment, so BYOK setup cannot be saved persistently here.",
  telemetrySummary:
    "TrackItUp stores only local AI telemetry counters on this device so you can verify feature usage. Prompts, transcript text, attachments, and workspace context are not stored in telemetry.",
};
