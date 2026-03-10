import { knownTemplateCatalog } from "../../constants/TrackItUpDefaults.ts";
import type {
    FormFieldType,
    TemplateCatalogItem,
    TemplateImportMethod,
    TemplateOrigin,
    WorkspaceSnapshot,
} from "../../types/trackitup.ts";

const supportedFieldTypes: FormFieldType[] = [
  "text",
  "rich-text",
  "textarea",
  "number",
  "unit",
  "select",
  "multi-select",
  "date-time",
  "checkbox",
  "checklist",
  "slider",
  "tags",
  "media",
  "location",
  "formula",
];

const fallbackFieldTypes: FormFieldType[] = [
  "text",
  "rich-text",
  "number",
  "tags",
];

const MAX_TEMPLATE_IMPORT_URL_LENGTH = 4096;
const MAX_TEMPLATE_ID_LENGTH = 120;
const MAX_TEMPLATE_NAME_LENGTH = 80;
const MAX_TEMPLATE_SUMMARY_LENGTH = 280;
const MAX_TEMPLATE_CATEGORY_LENGTH = 60;

export type ParsedTemplateImport = {
  templateId?: string;
  name?: string;
  summary?: string;
  category?: string;
  origin?: TemplateOrigin;
  importMethods: TemplateImportMethod[];
  supportedFieldTypes: FormFieldType[];
  importedVia: TemplateImportMethod;
  sourceUrl: string;
};

export type TemplateImportResult = {
  status: "imported" | "existing" | "invalid";
  message: string;
  template?: TemplateCatalogItem;
  workspace: WorkspaceSnapshot;
};

function splitList(value: string | null) {
  return (value ?? "")
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings<T extends string>(values: T[]) {
  return [...new Set(values)];
}

function toImportMethod(
  value: string | null | undefined,
): TemplateImportMethod | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "deep-link") return "deep-link";
  if (normalized === "qr-code" || normalized === "qr") return "qr-code";
  if (normalized === "local") return "local";
  return undefined;
}

function toOrigin(
  value: string | null | undefined,
): TemplateOrigin | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "official") return "official";
  if (normalized === "community") return "community";
  return undefined;
}

function toFieldTypes(value: string | null) {
  return uniqueStrings(
    splitList(value).filter((item): item is FormFieldType =>
      supportedFieldTypes.includes(item as FormFieldType),
    ),
  );
}

function normalizeImportText(
  value: string | null | undefined,
  maxLength: number,
) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function matchesTemplateImportPath(url: URL) {
  const host = url.host.replace(/^\/+|\/+$/g, "").toLowerCase();
  const path = url.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  const combined = [host, path].filter(Boolean).join("/");

  return (
    combined.includes("template-import") ||
    combined.includes("templates/import")
  );
}

function isSupportedTemplateImportUrl(url: URL) {
  const protocol = url.protocol.replace(/:$/g, "").toLowerCase();
  if (protocol === "trackitup") {
    return true;
  }

  return protocol === "https" && matchesTemplateImportPath(url);
}

function findCatalogTemplate(
  templates: TemplateCatalogItem[],
  parsed: ParsedTemplateImport,
) {
  const normalizedId = parsed.templateId?.trim().toLowerCase();
  const normalizedName = parsed.name?.trim().toLowerCase();

  return templates.find((template) => {
    if (normalizedId && template.id.trim().toLowerCase() === normalizedId) {
      return true;
    }

    return Boolean(
      normalizedName && template.name.trim().toLowerCase() === normalizedName,
    );
  });
}

function buildImportedTemplate(
  parsed: ParsedTemplateImport,
): TemplateCatalogItem {
  return {
    id: parsed.templateId?.trim() || `template-import-${Date.now()}`,
    name: parsed.name?.trim() || "Imported community template",
    summary:
      parsed.summary?.trim() ||
      "Imported from a shared TrackItUp deep link or QR code.",
    category: parsed.category?.trim() || "Community",
    origin: parsed.origin ?? "community",
    importMethods: uniqueStrings([...parsed.importMethods, parsed.importedVia]),
    supportedFieldTypes:
      parsed.supportedFieldTypes.length > 0
        ? parsed.supportedFieldTypes
        : fallbackFieldTypes,
  };
}

export function parseTemplateImportUrl(
  rawUrl: string,
  preferredMethod?: TemplateImportMethod,
): ParsedTemplateImport | null {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl || trimmedUrl.length > MAX_TEMPLATE_IMPORT_URL_LENGTH) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmedUrl);
  } catch {
    return null;
  }

  if (!isSupportedTemplateImportUrl(url)) {
    return null;
  }

  const params = url.searchParams;
  const templateId = normalizeImportText(
    params.get("templateId") ?? params.get("id"),
    MAX_TEMPLATE_ID_LENGTH,
  );
  const name = normalizeImportText(
    params.get("name") ?? params.get("title"),
    MAX_TEMPLATE_NAME_LENGTH,
  );
  const summary = normalizeImportText(
    params.get("summary") ?? params.get("description"),
    MAX_TEMPLATE_SUMMARY_LENGTH,
  );
  const category = normalizeImportText(
    params.get("category"),
    MAX_TEMPLATE_CATEGORY_LENGTH,
  );
  const origin = toOrigin(params.get("origin"));
  const importMethods = uniqueStrings(
    [
      ...splitList(params.get("methods") ?? params.get("importMethods"))
        .map((item) => toImportMethod(item))
        .filter((item): item is TemplateImportMethod => Boolean(item)),
      preferredMethod,
      toImportMethod(params.get("source") ?? params.get("method")),
    ].filter((item): item is TemplateImportMethod => Boolean(item)),
  );
  const importedVia =
    preferredMethod ??
    toImportMethod(params.get("source") ?? params.get("method")) ??
    "deep-link";
  const supportedTypes = toFieldTypes(
    params.get("fields") ??
      params.get("fieldTypes") ??
      params.get("supportedFieldTypes"),
  );
  const looksLikeTemplateImport =
    matchesTemplateImportPath(url) ||
    Boolean(templateId) ||
    (url.protocol.replace(/:$/g, "").toLowerCase() === "trackitup" &&
      Boolean(name && category)) ||
    params.has("fields") ||
    params.has("fieldTypes") ||
    params.has("supportedFieldTypes");

  if (!looksLikeTemplateImport) {
    return null;
  }

  return {
    templateId,
    name,
    summary,
    category,
    origin,
    importMethods,
    supportedFieldTypes: supportedTypes,
    importedVia,
    sourceUrl: trimmedUrl,
  };
}

export function applyTemplateImportToWorkspace(
  workspace: WorkspaceSnapshot,
  rawUrl: string,
  preferredMethod?: TemplateImportMethod,
  knownTemplates: TemplateCatalogItem[] = knownTemplateCatalog,
): TemplateImportResult {
  const parsed = parseTemplateImportUrl(rawUrl, preferredMethod);

  if (!parsed) {
    return {
      status: "invalid",
      message:
        "This link does not contain a TrackItUp template import payload.",
      workspace,
    };
  }

  const existingTemplate = findCatalogTemplate(workspace.templates, parsed);
  if (existingTemplate) {
    return {
      status: "existing",
      message: `${existingTemplate.name} is already available in this workspace catalog.`,
      template: existingTemplate,
      workspace,
    };
  }

  const knownTemplate = findCatalogTemplate(knownTemplates, parsed);
  const template = knownTemplate
    ? {
        ...knownTemplate,
        importMethods: uniqueStrings([
          ...knownTemplate.importMethods,
          ...parsed.importMethods,
          parsed.importedVia,
        ]),
      }
    : buildImportedTemplate(parsed);

  return {
    status: "imported",
    message: `Imported ${template.name} into the TrackItUp template catalog.`,
    template,
    workspace: {
      ...workspace,
      generatedAt: new Date().toISOString(),
      templates: [template, ...workspace.templates],
    },
  };
}
