import * as Print from "expo-print";

import { buildVisualRecapHtml } from "@/services/export/workspaceVisualRecapContent";
import type { VisualHistoryMonthlyRecap } from "@/services/insights/workspaceVisualHistory";

export async function exportVisualRecapPdfAsync(
  scopeLabel: string,
  recap: VisualHistoryMonthlyRecap,
) {
  const result = await Print.printToFileAsync({
    html: buildVisualRecapHtml(scopeLabel, recap),
  });
  return result.uri;
}
