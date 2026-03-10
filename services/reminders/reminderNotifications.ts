import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
    getReminderScheduleTimestamp,
    isReminderOpen,
} from "@/services/insights/workspaceInsights";
import {
    REMINDER_NOTIFICATION_COMPLETE_ACTION_ID,
    REMINDER_NOTIFICATION_SKIP_ACTION_ID,
    REMINDER_NOTIFICATION_SNOOZE_ACTION_ID,
    TRACKITUP_REMINDER_ROUTE,
    TRACKITUP_REMINDER_SOURCE,
} from "@/services/reminders/reminderNotificationIntents";
import type { WorkspaceSnapshot } from "@/types/trackitup";

const TRACKITUP_REMINDER_CHANNEL_ID = "trackitup-reminders";
const TRACKITUP_REMINDER_CATEGORY_ID = "trackitupReminderActions";
const MAX_SCHEDULED_REMINDERS = 48;

export type ReminderNotificationPermissionStatus =
  | "unsupported"
  | "undetermined"
  | "denied"
  | "granted";

export type ReminderNotificationPermissionState = {
  status: ReminderNotificationPermissionStatus;
  canAskAgain: boolean;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function mapPermissionState(
  response: Pick<
    Notifications.NotificationPermissionsStatus,
    "granted" | "status" | "canAskAgain"
  >,
): ReminderNotificationPermissionState {
  if (
    response.granted ||
    response.status === Notifications.PermissionStatus.GRANTED
  ) {
    return { status: "granted", canAskAgain: response.canAskAgain };
  }

  if (response.status === Notifications.PermissionStatus.DENIED) {
    return { status: "denied", canAskAgain: response.canAskAgain };
  }

  return { status: "undetermined", canAskAgain: response.canAskAgain };
}

async function ensureReminderNotificationChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(
    TRACKITUP_REMINDER_CHANNEL_ID,
    {
      name: "TrackItUp reminders",
      description: "Upcoming and snoozed maintenance reminders from TrackItUp.",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      enableVibrate: true,
      showBadge: true,
    },
  );
}

async function ensureReminderNotificationCategory() {
  if (Platform.OS === "web") return;

  await Notifications.setNotificationCategoryAsync(
    TRACKITUP_REMINDER_CATEGORY_ID,
    [
      {
        identifier: REMINDER_NOTIFICATION_COMPLETE_ACTION_ID,
        buttonTitle: "Complete",
      },
      {
        identifier: REMINDER_NOTIFICATION_SNOOZE_ACTION_ID,
        buttonTitle: "Snooze",
      },
      {
        identifier: REMINDER_NOTIFICATION_SKIP_ACTION_ID,
        buttonTitle: "Skip",
      },
    ],
  );
}

export async function getReminderNotificationPermissionState(): Promise<ReminderNotificationPermissionState> {
  if (Platform.OS === "web") {
    return { status: "unsupported", canAskAgain: false };
  }

  const response = await Notifications.getPermissionsAsync();
  return mapPermissionState(response);
}

export async function requestReminderNotificationPermissions(): Promise<ReminderNotificationPermissionState> {
  if (Platform.OS === "web") {
    return { status: "unsupported", canAskAgain: false };
  }

  await ensureReminderNotificationChannel();
  await ensureReminderNotificationCategory();

  const response = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
      allowDisplayInCarPlay: false,
      provideAppNotificationSettings: false,
    },
  });

  return mapPermissionState(response);
}

export async function clearScheduledReminderNotifications() {
  if (Platform.OS === "web") return 0;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const reminderNotifications = scheduled.filter(
    (request) => request.content.data?.source === TRACKITUP_REMINDER_SOURCE,
  );

  await Promise.all(
    reminderNotifications.map((request) =>
      Notifications.cancelScheduledNotificationAsync(request.identifier),
    ),
  );

  return reminderNotifications.length;
}

export async function syncWorkspaceReminderNotifications(
  workspace: WorkspaceSnapshot,
) {
  if (Platform.OS === "web") {
    return { scheduledCount: 0, cancelledCount: 0 };
  }

  await ensureReminderNotificationChannel();
  await ensureReminderNotificationCategory();
  const cancelledCount = await clearScheduledReminderNotifications();
  const permission = await getReminderNotificationPermissionState();

  if (permission.status !== "granted") {
    return { scheduledCount: 0, cancelledCount };
  }

  const now = Date.now();
  const spacesById = new Map(
    workspace.spaces.map((space) => [space.id, space] as const),
  );
  const reminders = [...workspace.reminders]
    .filter(isReminderOpen)
    .map((reminder) => ({
      reminder,
      scheduledAt: new Date(getReminderScheduleTimestamp(reminder)).getTime(),
    }))
    .filter(
      (item) => Number.isFinite(item.scheduledAt) && item.scheduledAt > now,
    )
    .sort((left, right) => left.scheduledAt - right.scheduledAt)
    .slice(0, MAX_SCHEDULED_REMINDERS);

  for (const { reminder, scheduledAt } of reminders) {
    const spaceName = spacesById.get(reminder.spaceId)?.name ?? "Tracked space";
    const subtitle =
      reminder.ruleLabel ?? reminder.triggerCondition ?? spaceName;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        subtitle,
        body: `${spaceName} • due ${new Date(scheduledAt).toLocaleString()}`,
        categoryIdentifier: TRACKITUP_REMINDER_CATEGORY_ID,
        sound: "default",
        data: {
          source: TRACKITUP_REMINDER_SOURCE,
          route: TRACKITUP_REMINDER_ROUTE,
          reminderId: reminder.id,
          spaceId: reminder.spaceId,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        channelId: TRACKITUP_REMINDER_CHANNEL_ID,
        date: new Date(scheduledAt),
      },
    });
  }

  return {
    scheduledCount: reminders.length,
    cancelledCount,
  };
}
