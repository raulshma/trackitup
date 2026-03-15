export const TRACKITUP_REMINDER_SOURCE = "trackitup-reminder";
export const TRACKITUP_REMINDER_ROUTE = "action-center";
export const TRACKITUP_RECURRING_SOURCE = "trackitup-recurring";
export const TRACKITUP_RECURRING_ROUTE = "action-center";
export const REMINDER_NOTIFICATION_DEFAULT_ACTION_ID =
  "expo.modules.notifications.actions.DEFAULT";
export const RECURRING_NOTIFICATION_DEFAULT_ACTION_ID =
  REMINDER_NOTIFICATION_DEFAULT_ACTION_ID;
export const REMINDER_NOTIFICATION_COMPLETE_ACTION_ID =
  "trackitupReminderComplete";
export const REMINDER_NOTIFICATION_SNOOZE_ACTION_ID = "trackitupReminderSnooze";
export const REMINDER_NOTIFICATION_SKIP_ACTION_ID = "trackitupReminderSkip";
export const RECURRING_NOTIFICATION_COMPLETE_ACTION_ID =
  "trackitupRecurringComplete";
export const RECURRING_NOTIFICATION_SNOOZE_ACTION_ID =
  "trackitupRecurringSnooze";
export const RECURRING_NOTIFICATION_SKIP_ACTION_ID = "trackitupRecurringSkip";

export type ReminderNotificationResponseIntent = {
  reminderId: string;
  spaceId?: string;
  spaceIds?: string[];
  route?: string;
  kind: "default" | "complete" | "snooze" | "skip";
};

export type RecurringNotificationResponseIntent = {
  occurrenceId: string;
  planId?: string;
  spaceId?: string;
  spaceIds?: string[];
  route?: string;
  kind: "default" | "complete" | "snooze" | "skip";
};

function normalizeSpaceIdsFromData(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(/[;,]/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  return [];
}

type ReminderNotificationResponseLike = {
  actionIdentifier: string;
  notification: {
    request: {
      content: {
        data?: Record<string, unknown>;
      };
    };
  };
};

export function getReminderNotificationResponseIntent(
  response: ReminderNotificationResponseLike,
): ReminderNotificationResponseIntent | null {
  const data = response.notification.request.content.data;
  if (data?.source !== TRACKITUP_REMINDER_SOURCE) return null;
  if (typeof data.reminderId !== "string") return null;

  const base = {
    reminderId: data.reminderId,
    spaceId: typeof data.spaceId === "string" ? data.spaceId : undefined,
    ...(normalizeSpaceIdsFromData(data.spaceIds).length > 0
      ? { spaceIds: normalizeSpaceIdsFromData(data.spaceIds) }
      : {}),
    route: typeof data.route === "string" ? data.route : undefined,
  };

  if (response.actionIdentifier === REMINDER_NOTIFICATION_DEFAULT_ACTION_ID) {
    return { ...base, kind: "default" };
  }

  if (response.actionIdentifier === REMINDER_NOTIFICATION_COMPLETE_ACTION_ID) {
    return { ...base, kind: "complete" };
  }

  if (response.actionIdentifier === REMINDER_NOTIFICATION_SNOOZE_ACTION_ID) {
    return { ...base, kind: "snooze" };
  }

  if (response.actionIdentifier === REMINDER_NOTIFICATION_SKIP_ACTION_ID) {
    return { ...base, kind: "skip" };
  }

  return null;
}

export function getRecurringNotificationResponseIntent(
  response: ReminderNotificationResponseLike,
): RecurringNotificationResponseIntent | null {
  const data = response.notification.request.content.data;
  if (data?.source !== TRACKITUP_RECURRING_SOURCE) return null;
  if (typeof data.occurrenceId !== "string") return null;

  const base = {
    occurrenceId: data.occurrenceId,
    planId: typeof data.planId === "string" ? data.planId : undefined,
    spaceId: typeof data.spaceId === "string" ? data.spaceId : undefined,
    ...(normalizeSpaceIdsFromData(data.spaceIds).length > 0
      ? { spaceIds: normalizeSpaceIdsFromData(data.spaceIds) }
      : {}),
    route: typeof data.route === "string" ? data.route : undefined,
  };

  if (response.actionIdentifier === REMINDER_NOTIFICATION_DEFAULT_ACTION_ID) {
    return { ...base, kind: "default" };
  }

  if (response.actionIdentifier === RECURRING_NOTIFICATION_COMPLETE_ACTION_ID) {
    return { ...base, kind: "complete" };
  }

  if (response.actionIdentifier === RECURRING_NOTIFICATION_SNOOZE_ACTION_ID) {
    return { ...base, kind: "snooze" };
  }

  if (response.actionIdentifier === RECURRING_NOTIFICATION_SKIP_ACTION_ID) {
    return { ...base, kind: "skip" };
  }

  return null;
}
