export const trackItUpSeedIds = {
  spaces: ["reef", "plants", "living-room", "garage"],
  assets: [
    "asset-filter",
    "asset-betta",
    "asset-monstera",
    "asset-pothos",
    "asset-brakes",
  ],
  metricDefinitions: [
    "metric-salinity",
    "metric-alkalinity",
    "metric-moisture",
    "metric-brake-thickness",
  ],
  routines: ["routine-reef-weekly", "routine-plant-feed"],
  reminders: [
    "reminder-reef-ammonia",
    "reminder-reef-weekly",
    "reminder-plant-water",
    "reminder-pothos-feed",
    "reminder-brake-inspection",
    "reminder-tire-rotation",
  ],
  logs: [
    "log-reef-chemistry-baseline",
    "log-reef-chemistry-follow-up",
    "log-salinity",
    "log-alkalinity-low",
    "log-plant-routine",
    "log-filter-reminder",
    "log-brake-reminder",
    "log-pothos-light",
  ],
  expenses: [
    "expense-reef-supplements",
    "expense-plant-feed",
    "expense-brakes",
  ],
  templates: [
    "template-reef-official",
    "template-plants-official",
    "template-foraging-community",
  ],
};

export const trackItUpSeedIdSets = {
  spaces: new Set(trackItUpSeedIds.spaces),
  assets: new Set(trackItUpSeedIds.assets),
  metricDefinitions: new Set(trackItUpSeedIds.metricDefinitions),
  routines: new Set(trackItUpSeedIds.routines),
  reminders: new Set(trackItUpSeedIds.reminders),
  logs: new Set(trackItUpSeedIds.logs),
  expenses: new Set(trackItUpSeedIds.expenses),
  templates: new Set(trackItUpSeedIds.templates),
};
