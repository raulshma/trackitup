import type { VisualHistoryMonthlyRecap } from "@/services/insights/workspaceVisualHistory";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatMonth(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function buildVisualRecapTitle(
  scopeLabel: string,
  recap: VisualHistoryMonthlyRecap,
) {
  return `${scopeLabel} • ${formatMonth(recap.monthKey)} recap`;
}

export function buildVisualRecapShareMessage(
  scopeLabel: string,
  recap: VisualHistoryMonthlyRecap,
) {
  return `${buildVisualRecapTitle(scopeLabel, recap)} — ${recap.photoCount} photo(s), ${recap.proofCount} proof shot(s), highlights captured in TrackItUp.`;
}

export function buildVisualRecapHtml(
  scopeLabel: string,
  recap: VisualHistoryMonthlyRecap,
) {
  const title = buildVisualRecapTitle(scopeLabel, recap);
  const spotlight = recap.items.slice(0, 4);

  return `
    <html>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #eff6ff; color: #0f172a;">
        <div style="background: linear-gradient(160deg, #dbeafe, #f8fafc); border: 1px solid #bfdbfe; border-radius: 28px; padding: 24px;">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #4338ca; font-weight: 700;">TrackItUp visual recap</div>
          <h1 style="margin: 10px 0 6px; font-size: 28px;">${escapeHtml(title)}</h1>
          <p style="margin: 0 0 20px; color: #475569;">Monthly highlight reel built from log attachments and proof-of-completion photos.</p>

          <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 22px;">
            <div style="min-width: 140px; background: #ffffff; border-radius: 18px; padding: 14px; border: 1px solid #dbeafe;">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Photos</div>
              <div style="font-size: 22px; font-weight: 700; margin-top: 4px;">${recap.photoCount}</div>
            </div>
            <div style="min-width: 140px; background: #ffffff; border-radius: 18px; padding: 14px; border: 1px solid #dbeafe;">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Proof shots</div>
              <div style="font-size: 22px; font-weight: 700; margin-top: 4px;">${recap.proofCount}</div>
            </div>
            <div style="min-width: 200px; background: #ffffff; border-radius: 18px; padding: 14px; border: 1px solid #dbeafe;">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Period</div>
              <div style="font-size: 22px; font-weight: 700; margin-top: 4px;">${escapeHtml(formatMonth(recap.monthKey))}</div>
            </div>
          </div>

          <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px;">
            ${spotlight
              .map(
                (item) => `
                  <div style="width: 220px; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #dbeafe;">
                    <img src="${escapeHtml(item.uri)}" style="width: 100%; height: 160px; object-fit: cover; display: block; background: #e2e8f0;" />
                    <div style="padding: 12px 14px;">
                      <div style="font-size: 15px; font-weight: 700; margin-bottom: 4px;">${escapeHtml(item.logTitle)}</div>
                      <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">${escapeHtml(item.spaceName)} • ${escapeHtml(formatDate(item.capturedAt))}</div>
                      <div style="font-size: 12px; color: #334155;">${escapeHtml((item.proofLabel ?? item.logNote) || item.logKind)}</div>
                    </div>
                  </div>
                `,
              )
              .join("")}
          </div>

          <div style="background: #ffffff; border-radius: 18px; padding: 16px 18px; border: 1px solid #dbeafe;">
            <div style="font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #4338ca;">Moments captured</div>
            <ul style="padding-left: 20px; margin: 0;">
              ${recap.items
                .slice(0, 8)
                .map(
                  (item) => `
                    <li style="margin-bottom: 6px; color: #334155;">
                      <strong>${escapeHtml(item.logTitle)}</strong> — ${escapeHtml(item.spaceName)} • ${escapeHtml(formatDate(item.capturedAt))}${item.proofLabel ? ` • ${escapeHtml(item.proofLabel)}` : ""}
                    </li>
                  `,
                )
                .join("")}
            </ul>
          </div>
        </div>
      </body>
    </html>
  `;
}
