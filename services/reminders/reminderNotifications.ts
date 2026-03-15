import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  getReminderScheduleTimestamp,
  isReminderOpen,
} from "@/services/insights/workspaceInsights";
import {
  RECURRING_NOTIFICATION_COMPLETE_ACTION_ID,
  RECURRING_NOTIFICATION_SKIP_ACTION_ID,
  RECURRING_NOTIFICATION_SNOOZE_ACTION_ID,
  REMINDER_NOTIFICATION_COMPLETE_ACTION_ID,
  REMINDER_NOTIFICATION_SKIP_ACTION_ID,
  REMINDER_NOTIFICATION_SNOOZE_ACTION_ID,
  TRACKITUP_RECURRING_ROUTE,
  TRACKITUP_RECURRING_SOURCE,
  TRACKITUP_REMINDER_ROUTE,
  TRACKITUP_REMINDER_SOURCE,
} from "@/services/reminders/reminderNotificationIntents";
import type { WorkspaceSnapshot } from "@/types/trackitup";

const TRACKITUP_REMINDER_CHANNEL_ID = "trackitup-reminders";
const TRACKITUP_REMINDER_CATEGORY_ID = "trackitupReminderActions";
const TRACKITUP_RECURRING_CATEGORY_ID = "trackitupRecurringActions";
const MAX_SCHEDULED_REMINDERS = 48;
const MAX_SCHEDULED_RECURRING_BATCHES = 48;

function normalizeSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

function primarySpaceId(value: { spaceId?: string; spaceIds?: string[] }) {
  return normalizeSpaceIds(value)[0] ?? value.spaceId;
}

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

  await Notifications.setNotificationCategoryAsync(
    TRACKITUP_RECURRING_CATEGORY_ID,
    [
      {
        identifier: RECURRING_NOTIFICATION_COMPLETE_ACTION_ID,
        buttonTitle: "Complete",
      },
      {
        identifier: RECURRING_NOTIFICATION_SNOOZE_ACTION_ID,
        buttonTitle: "Snooze",
      },
      {
        identifier: RECURRING_NOTIFICATION_SKIP_ACTION_ID,
        buttonTitle: "Skip",
      },
    ],
  );
}

function toMinuteKey(timestampMs: number) {
  const date = new Date(timestampMs);
  date.setSeconds(0, 0);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
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
    (request) =>
      request.content.data?.source === TRACKITUP_REMINDER_SOURCE ||
      request.content.data?.source === TRACKITUP_RECURRING_SOURCE,
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

  const activePlansById = new Map(
    workspace.recurringPlans
      .filter((plan) => plan.status === "active")
      .map((plan) => [plan.id, plan] as const),
  );

  const groupedRecurring = workspace.recurringOccurrences
    .filter((occurrence) => occurrence.status === "scheduled")
    .map((occurrence) => {
      const plan = activePlansById.get(occurrence.planId);
      if (!plan) return null;
      const effectiveDueAt = new Date(
        occurrence.snoozedUntil ?? occurrence.dueAt,
      ).getTime();
      if (!Number.isFinite(effectiveDueAt) || effectiveDueAt <= now) {
        return null;
      }

      return {
        occurrence,
        plan,
        effectiveDueAt,
      };
    })
    .filter(
      (
        item,
      ): item is {
        occurrence: WorkspaceSnapshot["recurringOccurrences"][number];
        plan: WorkspaceSnapshot["recurringPlans"][number];
        effectiveDueAt: number;
      } => Boolean(item),
    )
    .reduce<
      Map<
        string,
        {
          scheduledAt: number;
          occurrences: Array<{
            occurrenceId: string;
            planId: string;
            title: string;
            spaceId: string;
            spaceIds?: string[];
          }>;
        }
      >
    >((map, item) => {
      const key = toMinuteKey(item.effectiveDueAt);
      const existing = map.get(key) ?? {
        scheduledAt: item.effectiveDueAt,
        occurrences: [],
      };
      const planSpaceIds = normalizeSpaceIds(item.plan);
      existing.occurrences.push({
        occurrenceId: item.occurrence.id,
        planId: item.plan.id,
        title: item.plan.title,
        spaceId: primarySpaceId(item.plan) ?? item.plan.spaceId,
        spaceIds: planSpaceIds,
      });
      map.set(key, existing);
      return map;
    }, new Map());

  const recurringGroups = Array.from(groupedRecurring.values())
    .sort((left, right) => left.scheduledAt - right.scheduledAt)
    .slice(0, MAX_SCHEDULED_RECURRING_BATCHES);

  for (const { reminder, scheduledAt } of reminders) {
    const reminderSpaceId = primarySpaceId(reminder) ?? reminder.spaceId;
    const reminderSpaceIds = normalizeSpaceIds(reminder);
    const spaceName = spacesById.get(reminderSpaceId)?.name ?? "Tracked space";
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
          spaceId: reminderSpaceId,
          spaceIds: reminderSpaceIds,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        channelId: TRACKITUP_REMINDER_CHANNEL_ID,
        date: new Date(scheduledAt),
      },
    });
  }

  for (const recurringGroup of recurringGroups) {
    const first = recurringGroup.occurrences[0];
    if (!first) continue;

    const firstSpaceName =
      spacesById.get(first.spaceId)?.name ?? "Tracked space";
    const body =
      recurringGroup.occurrences.length === 1
        ? `${firstSpaceName} • due ${new Date(recurringGroup.scheduledAt).toLocaleString()}`
        : `${firstSpaceName} • ${recurringGroup.occurrences.length} routine occurrence(s) due now`;

    const title =
      recurringGroup.occurrences.length === 1
        ? first.title
        : `${recurringGroup.occurrences.length} routines due`;

    const subtitle =
      recurringGroup.occurrences.length === 1
        ? "Recurring routine"
        : recurringGroup.occurrences
            .slice(0, 2)
            .map((item) => item.title)
            .join(" • ");

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        subtitle,
        body,
        categoryIdentifier:
          recurringGroup.occurrences.length === 1
            ? TRACKITUP_RECURRING_CATEGORY_ID
            : undefined,
        sound: "default",
        data: {
          source: TRACKITUP_RECURRING_SOURCE,
          route: TRACKITUP_RECURRING_ROUTE,
          occurrenceId: first.occurrenceId,
          occurrenceIds: recurringGroup.occurrences.map(
            (item) => item.occurrenceId,
          ),
          planId: first.planId,
          spaceId: first.spaceId,
          spaceIds: first.spaceIds,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        channelId: TRACKITUP_REMINDER_CHANNEL_ID,
        date: new Date(recurringGroup.scheduledAt),
      },
    });
  }

  return {
    scheduledCount: reminders.length + recurringGroups.length,
    cancelledCount,
  };
}
