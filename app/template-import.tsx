import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Surface } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChipRow } from "@/components/ui/ChipRow";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
    uiBorder,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { parseTemplateImportUrl } from "@/services/templates/templateImport";
import type { TemplateImportMethod } from "@/types/trackitup";

type ImportParams = {
  url?: string | string[];
  source?: string | string[];
  templateId?: string | string[];
  id?: string | string[];
  name?: string | string[];
  title?: string | string[];
  summary?: string | string[];
  description?: string | string[];
  category?: string | string[];
  origin?: string | string[];
  fields?: string | string[];
  fieldTypes?: string | string[];
  supportedFieldTypes?: string | string[];
  methods?: string | string[];
  importMethods?: string | string[];
};

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toMethod(value: string | undefined): TemplateImportMethod | undefined {
  if (value === "deep-link" || value === "qr-code" || value === "local") {
    return value;
  }

  return undefined;
}

function buildImportUrlFromParams(params: ImportParams) {
  const explicitUrl = pickParam(params.url);
  if (explicitUrl) return explicitUrl;

  const searchParams = new URLSearchParams();
  const entries = [
    ["templateId", pickParam(params.templateId) ?? pickParam(params.id)],
    ["name", pickParam(params.name) ?? pickParam(params.title)],
    ["summary", pickParam(params.summary) ?? pickParam(params.description)],
    ["category", pickParam(params.category)],
    ["origin", pickParam(params.origin)],
    [
      "fields",
      pickParam(params.fields) ??
        pickParam(params.fieldTypes) ??
        pickParam(params.supportedFieldTypes),
    ],
    ["methods", pickParam(params.methods) ?? pickParam(params.importMethods)],
  ] as const;

  entries.forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `trackitup://template-import?${query}` : "";
}

export default function TemplateImportScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const params = useLocalSearchParams<ImportParams>();
  const { createRestorePoint, importTemplateFromUrl, workspace } =
    useWorkspace();
  const [statusMessage, setStatusMessage] = useState(
    "Preparing the template import...",
  );
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [lastImportKey, setLastImportKey] = useState<string | null>(null);

  const importUrl = useMemo(() => buildImportUrlFromParams(params), [params]);
  const preferredMethod = useMemo(
    () => toMethod(pickParam(params.source)),
    [params.source],
  );
  const importKey = `${preferredMethod ?? "auto"}:${importUrl}`;
  const parsedImport = useMemo(
    () => parseTemplateImportUrl(importUrl, preferredMethod),
    [importUrl, preferredMethod],
  );

  useEffect(() => {
    setTemplateName(null);
    setLastImportKey(null);

    if (!importUrl) {
      setStatusMessage(
        "No TrackItUp template import data was found in this route.",
      );
      return;
    }

    if (!parsedImport) {
      setStatusMessage(
        "This route does not contain a supported TrackItUp template import link.",
      );
      return;
    }

    setStatusMessage(
      "Review the shared template details below before adding it to your local workspace catalog.",
    );
  }, [importKey, importUrl, parsedImport]);

  const isImportDisabled = !parsedImport || lastImportKey === importKey;

  const handleImport = async () => {
    if (!importUrl || !parsedImport || lastImportKey === importKey) {
      return;
    }

    const restorePointResult = await createRestorePoint({
      reason: "before-template-import",
      label: "Before template import",
    });
    const result = importTemplateFromUrl(importUrl, preferredMethod);
    setStatusMessage(
      restorePointResult.status === "created" ||
        restorePointResult.status === "unavailable"
        ? `${restorePointResult.message} ${result.message}`
        : result.message,
    );
    setTemplateName(result.templateName ?? null);
    setLastImportKey(importKey);
  };
  const pageQuickActions = [
    {
      id: "template-import-primary",
      label: templateName ? "Imported" : "Import template",
      hint: parsedImport
        ? `${parsedImport.supportedFieldTypes.length} supported field type${parsedImport.supportedFieldTypes.length === 1 ? "" : "s"} from ${parsedImport.origin ?? "a shared source"}.`
        : "Import unlocks once this route contains a valid TrackItUp template link.",
      onPress: () => void handleImport(),
      accentColor: palette.tint,
      disabled: isImportDisabled,
    },
    {
      id: "template-import-scan",
      label: "Scan again",
      hint: "Use the scanner when the template came from a QR label or printed share card.",
      onPress: () => router.replace("/scanner" as never),
      accentColor: palette.secondary,
    },
    {
      id: "template-import-builder",
      label: "Open schema builder",
      hint: `${workspace.templates.length} template${workspace.templates.length === 1 ? "" : "s"} are already available in this local catalog.`,
      onPress: () => router.push("/schema-builder" as never),
    },
  ];

  return (
    <View style={[styles.screen, paletteStyles.screenBackground]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Stack.Screen options={{ title: "Template import" }} />

        <ScreenHero
          palette={palette}
          title="Template import"
          subtitle="Review a shared template from a deep link or scanned QR code before adding it to the local workspace catalog."
          badges={[
            {
              label: "TrackItUp",
              backgroundColor: palette.card,
              textColor: palette.tint,
            },
            {
              label: preferredMethod
                ? `Source: ${preferredMethod}`
                : "Source: auto",
              backgroundColor: palette.accentSoft,
            },
          ]}
        />

        <PageQuickActions
          palette={palette}
          title="Move through template review faster"
          description="Import the current payload, rescan a QR source, or jump into the local schema builder when a shared template needs a custom follow-up."
          actions={pageQuickActions}
        />

        <SectionMessage
          palette={palette}
          label="Review required"
          title={parsedImport?.name ?? "Shared template"}
          message={
            parsedImport?.summary ??
            (importUrl
              ? "Only TrackItUp deep links and dedicated HTTPS import routes can add templates to this catalog."
              : "No URL or import payload was provided.")
          }
        >
          <ChipRow style={styles.statusChipRow}>
            {parsedImport?.category ? (
              <Chip compact style={styles.statusChip}>
                Category: {parsedImport.category}
              </Chip>
            ) : null}
            {parsedImport?.origin ? (
              <Chip compact style={styles.statusChip}>
                Origin: {parsedImport.origin}
              </Chip>
            ) : null}
            {parsedImport ? (
              <Chip compact style={styles.statusChip}>
                Fields: {parsedImport.supportedFieldTypes.length || 0}
              </Chip>
            ) : null}
            {parsedImport?.importMethods.length ? (
              <Chip compact style={styles.statusChip}>
                Methods: {parsedImport.importMethods.join(", ")}
              </Chip>
            ) : null}
          </ChipRow>
        </SectionMessage>

        <SectionMessage
          palette={palette}
          label="Import status"
          title={
            templateName
              ? `Imported ${templateName}`
              : "Workspace catalog update"
          }
          message={statusMessage}
        >
          <ChipRow style={styles.statusChipRow}>
            {templateName ? (
              <Chip compact style={styles.statusChip}>
                Template: {templateName}
              </Chip>
            ) : null}
            <Chip compact style={styles.statusChip}>
              Catalog: {workspace.templates.length} templates
            </Chip>
          </ChipRow>
        </SectionMessage>

        <SectionMessage
          palette={palette}
          label="Import payload"
          title="Detected import link"
          message={importUrl || "No URL or import payload was provided."}
        />
      </ScrollView>

      <Surface
        style={[
          styles.footer,
          {
            backgroundColor: palette.surface1,
            borderColor: palette.border,
            paddingBottom: uiSpace.lg + insets.bottom,
          },
        ]}
        elevation={2}
      >
        <View style={styles.footerActions}>
          <Button
            mode="outlined"
            onPress={() => router.replace("/scanner" as never)}
            style={styles.footerButton}
            contentStyle={styles.footerButtonContent}
            labelStyle={styles.footerButtonLabel}
          >
            Scan again
          </Button>
          <Button
            mode="contained-tonal"
            onPress={() => router.replace("/workspace-tools" as never)}
            style={styles.footerButton}
            contentStyle={styles.footerButtonContent}
            labelStyle={styles.footerButtonLabel}
          >
            Open tools
          </Button>
          <Button
            mode="contained"
            onPress={handleImport}
            disabled={isImportDisabled}
            style={styles.footerButton}
            contentStyle={styles.footerButtonContent}
            labelStyle={styles.footerButtonLabel}
          >
            Import template
          </Button>
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: uiSpace.screen, paddingBottom: uiSpace.screenBottom },
  body: uiTypography.body,
  statusChipRow: {
    marginBottom: uiSpace.md,
  },
  statusChip: { borderRadius: uiRadius.pill },
  footer: {
    borderTopWidth: uiBorder.standard,
    paddingHorizontal: uiSpace.screen,
    paddingTop: uiSpace.lg,
  },
  footerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: uiSpace.md,
  },
  footerButton: { alignSelf: "flex-start" },
  footerButtonContent: { minHeight: 40 },
  footerButtonLabel: {
    textAlign: "center",
  },
});
