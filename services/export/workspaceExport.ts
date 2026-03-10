import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";

import {
    buildWorkspaceExportJson,
    buildWorkspaceLogsCsv,
    buildWorkspaceSummaryHtml,
} from "@/services/export/workspaceExportContent";
import type { WorkspaceSnapshot } from "@/types/trackitup";

function timestampToken() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function exportWorkspaceJsonAsync(snapshot: WorkspaceSnapshot) {
  const file = new File(
    Paths.cache,
    `trackitup-workspace-${timestampToken()}.json`,
  );
  file.create({ intermediates: true, overwrite: true });
  file.write(buildWorkspaceExportJson(snapshot));
  return file.uri;
}

export async function exportWorkspaceLogsCsvAsync(snapshot: WorkspaceSnapshot) {
  const file = new File(Paths.cache, `trackitup-logs-${timestampToken()}.csv`);
  file.create({ intermediates: true, overwrite: true });
  file.write(buildWorkspaceLogsCsv(snapshot));
  return file.uri;
}

export async function exportWorkspaceSummaryPdfAsync(
  snapshot: WorkspaceSnapshot,
) {
  const result = await Print.printToFileAsync({
    html: buildWorkspaceSummaryHtml(snapshot),
  });
  return result.uri;
}
