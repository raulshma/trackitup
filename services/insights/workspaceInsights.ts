import type { Asset, Reminder, WorkspaceSnapshot } from "@/types/trackitup";

export type MetricChartPoint = {
  id: string;
  label: string;
  occurredAt: string;
  values: Record<string, number>;
};

export type ReminderCalendarCell = {
  key: string;
  label: string;
  date: string;
  inMonth: boolean;
  isToday: boolean;
  reminders: Reminder[];
};

const openReminderStatuses = new Set(["due", "scheduled", "snoozed"]);

function formatMonthDay(date: Date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getDateKey(timestamp: string) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function normalizeScannableCode(value: string) {
  return value.trim().toLowerCase();
}

export function findAssetByScannedCode(
  workspace: WorkspaceSnapshot,
  scannedCode: string,
): Asset | undefined {
  const normalizedCode = normalizeScannableCode(scannedCode);
  if (!normalizedCode) return undefined;

  return workspace.assets.find((asset) => {
    const barcode = normalizeScannableCode(asset.barcodeValue ?? "");
    const qrCode = normalizeScannableCode(asset.qrCodeValue ?? "");
    return barcode === normalizedCode || qrCode === normalizedCode;
  });
}

export function isReminderOpen(reminder: Reminder) {
  return openReminderStatuses.has(reminder.status);
}

export function getReminderScheduleTimestamp(reminder: Reminder) {
  return reminder.snoozedUntil ?? reminder.dueAt;
}

export function getReminderDateKey(reminder: Reminder | string) {
  return getDateKey(
    typeof reminder === "string"
      ? reminder
      : getReminderScheduleTimestamp(reminder),
  );
}

export function buildMetricChartPoints(
  workspace: WorkspaceSnapshot,
  metricIds: string[],
  maxPoints = 6,
): MetricChartPoint[] {
  const wantedMetricIds = new Set(metricIds);
  if (wantedMetricIds.size === 0) return [];

  return workspace.logs
    .filter((log) =>
      (log.metricReadings ?? []).some(
        (reading) =>
          wantedMetricIds.has(reading.metricId) &&
          typeof reading.value === "number",
      ),
    )
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .flatMap((log) => {
      const values = (log.metricReadings ?? []).reduce<Record<string, number>>(
        (current, reading) => {
          if (
            wantedMetricIds.has(reading.metricId) &&
            typeof reading.value === "number"
          ) {
            current[reading.metricId] = reading.value;
          }
          return current;
        },
        {},
      );

      if (Object.keys(values).length === 0) return [];

      return [
        {
          id: log.id,
          label: formatMonthDay(new Date(log.occurredAt)),
          occurredAt: log.occurredAt,
          values,
        },
      ];
    })
    .slice(-maxPoints);
}

export function buildReminderCalendar(
  referenceTimestamp: string,
  reminders: Reminder[],
  todayTimestamp = referenceTimestamp,
) {
  const referenceDate = new Date(referenceTimestamp);
  const monthStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
  );
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
  const todayKey = getDateKey(todayTimestamp);

  const remindersByDate = reminders
    .filter(isReminderOpen)
    .reduce<Map<string, Reminder[]>>((current, reminder) => {
      const key = getReminderDateKey(reminder);
      current.set(key, [...(current.get(key) ?? []), reminder]);
      return current;
    }, new Map());

  const weeks: ReminderCalendarCell[][] = [];

  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const week: ReminderCalendarCell[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const offset = weekIndex * 7 + dayIndex;
      const cellDate = new Date(calendarStart);
      cellDate.setDate(calendarStart.getDate() + offset);
      const cellDateString = cellDate.toISOString();
      const key = getDateKey(cellDateString);

      week.push({
        key,
        label: String(cellDate.getDate()),
        date: cellDateString,
        inMonth: cellDate.getMonth() === referenceDate.getMonth(),
        isToday: key === todayKey,
        reminders: remindersByDate.get(key) ?? [],
      });
    }

    weeks.push(week);
  }

  return {
    monthLabel: referenceDate.toLocaleDateString([], {
      month: "long",
      year: "numeric",
    }),
    weeks,
  };
}