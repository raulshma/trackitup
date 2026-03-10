import type { LogEntry } from "@/types/trackitup";

export function getLinkedLogEntries(logs: LogEntry[], entry?: LogEntry) {
  if (!entry) {
    return {
      parentEntry: undefined,
      childEntries: [] as LogEntry[],
    };
  }

  const parentEntry = entry.parentLogId
    ? logs.find((log) => log.id === entry.parentLogId)
    : undefined;
  const childEntries = (entry.childLogIds ?? [])
    .map((childId) => logs.find((log) => log.id === childId))
    .filter((log): log is LogEntry => Boolean(log));

  return { parentEntry, childEntries };
}