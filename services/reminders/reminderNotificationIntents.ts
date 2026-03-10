export const TRACKITUP_REMINDER_SOURCE = "trackitup-reminder";
export const TRACKITUP_REMINDER_ROUTE = "action-center";
export const REMINDER_NOTIFICATION_DEFAULT_ACTION_ID =
  "expo.modules.notifications.actions.DEFAULT";
export const REMINDER_NOTIFICATION_COMPLETE_ACTION_ID =
  "trackitupReminderComplete";
export const REMINDER_NOTIFICATION_SNOOZE_ACTION_ID =
  "trackitupReminderSnooze";
export const REMINDER_NOTIFICATION_SKIP_ACTION_ID = "trackitupReminderSkip";

export type ReminderNotificationResponseIntent = {
  reminderId: string;
  spaceId?: string;
  route?: string;
  kind: "default" | "complete" | "snooze" | "skip";
};

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