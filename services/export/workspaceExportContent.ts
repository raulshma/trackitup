import type { WorkspaceSnapshot } from "@/types/trackitup";
import { formatSpaceCategoryLabel } from "../../constants/TrackItUpSpaceCategories.ts";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeCsv(value: string | number | undefined) {
  const normalized = value === undefined ? "" : String(value);
  const safeValue =
    /^[=+\-@\t\r]/.test(normalized) || /^[ ]+[=+\-@]/.test(normalized)
      ? `'${normalized}`
      : normalized;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);

  return escapeHtml(
    date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  );
}

export function buildWorkspaceExportJson(snapshot: WorkspaceSnapshot) {
  return JSON.stringify(snapshot, null, 2);
}

export function buildWorkspaceLogsCsv(snapshot: WorkspaceSnapshot) {
  const spacesById = new Map(
    snapshot.spaces.map((space) => [space.id, space] as const),
  );
  const header = [
    "id",
    "spaceId",
    "spaceName",
    "kind",
    "title",
    "note",
    "occurredAt",
    "tags",
    "cost",
    "locationLabel",
    "attachmentsCount",
    "assetIds",
  ];
  const rows = snapshot.logs.map((log) => [
    log.id,
    log.spaceId,
    spacesById.get(log.spaceId)?.name ?? "",
    log.kind,
    log.title,
    log.note,
    log.occurredAt,
    (log.tags ?? []).join(";"),
    log.cost,
    log.locationLabel,
    log.attachmentsCount,
    (log.assetIds ?? []).join(";"),
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => escapeCsv(value)).join(","))
    .join("\n");
}

export function buildWorkspaceSummaryHtml(snapshot: WorkspaceSnapshot) {
  const recentLogs = [...snapshot.logs]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 8);
  const openReminders = snapshot.reminders.filter(
    (reminder) =>
      reminder.status !== "completed" && reminder.status !== "skipped",
  );
  const totalExpense = snapshot.expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const spacesById = new Map(
    snapshot.spaces.map((space) => [space.id, space] as const),
  );

  return `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a; line-height: 1.5;">
        <h1 style="margin-bottom: 8px;">TrackItUp workspace report</h1>
        <p style="margin-top: 0; color: #475569;">Generated at ${formatDateTime(snapshot.generatedAt)}</p>

        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0;">
          ${[
            ["Spaces", snapshot.spaces.length],
            ["Assets", snapshot.assets.length],
            ["Metrics", snapshot.metricDefinitions.length],
            ["Routines", snapshot.routines.length],
            ["Open reminders", openReminders.length],
            ["Logs", snapshot.logs.length],
            ["Tracked spend", formatCurrency(totalExpense)],
          ]
            .map(
              ([label, value]) => `
                <div style="min-width: 140px; border: 1px solid #cbd5e1; border-radius: 14px; padding: 12px 14px; background: #f8fafc;">
                  <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b;">${escapeHtml(String(label))}</div>
                  <div style="font-size: 20px; font-weight: 700; margin-top: 4px;">${escapeHtml(String(value))}</div>
                </div>
              `,
            )
            .join("")}
        </div>

        <h2>Space overview</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background: #e2e8f0;">
              <th style="text-align: left; padding: 10px;">Space</th>
              <th style="text-align: left; padding: 10px;">Category</th>
              <th style="text-align: left; padding: 10px;">Status</th>
              <th style="text-align: left; padding: 10px;">Summary</th>
            </tr>
          </thead>
          <tbody>
            ${snapshot.spaces
              .map(
                (space) => `
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${escapeHtml(space.name)}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(formatSpaceCategoryLabel(space.category))}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(space.status)}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(space.summary ?? "")}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>

        <h2>Upcoming reminders</h2>
        <ul style="padding-left: 20px; margin-bottom: 24px;">
          ${(openReminders.length
            ? openReminders
            : snapshot.reminders.slice(0, 5)
          )
            .map(
              (reminder) => `
                <li style="margin-bottom: 8px;">
                  <strong>${escapeHtml(reminder.title)}</strong>
                  — ${escapeHtml(spacesById.get(reminder.spaceId)?.name ?? reminder.spaceId)}
                  • ${escapeHtml(reminder.status)}
                  • ${formatDateTime(reminder.snoozedUntil ?? reminder.dueAt)}
                </li>
              `,
            )
            .join("")}
        </ul>

        <h2>Recent logbook activity</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background: #e2e8f0;">
              <th style="text-align: left; padding: 10px;">When</th>
              <th style="text-align: left; padding: 10px;">Space</th>
              <th style="text-align: left; padding: 10px;">Kind</th>
              <th style="text-align: left; padding: 10px;">Title</th>
              <th style="text-align: left; padding: 10px;">Tags</th>
            </tr>
          </thead>
          <tbody>
            ${recentLogs
              .map(
                (log) => `
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${formatDateTime(log.occurredAt)}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(spacesById.get(log.spaceId)?.name ?? log.spaceId)}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(log.kind)}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(log.title)}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml((log.tags ?? []).join(" • "))}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>

        <h2>Asset and expense summary</h2>
        <p style="margin-bottom: 8px;">The workspace currently tracks <strong>${snapshot.assets.length}</strong> assets and <strong>${snapshot.expenses.length}</strong> expenses totaling <strong>${escapeHtml(formatCurrency(totalExpense))}</strong>.</p>
        <ul style="padding-left: 20px;">
          ${snapshot.assets
            .slice(0, 8)
            .map(
              (asset) => `
            <li style="margin-bottom: 6px;">
              ${escapeHtml(asset.name)} — ${escapeHtml(asset.status)}
              (${escapeHtml(spacesById.get(asset.spaceId)?.name ?? asset.spaceId)})
            </li>
          `,
            )
            .join("")}
        </ul>
      </body>
    </html>
  `;
}
