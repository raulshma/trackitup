import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Button, Chip } from "react-native-paper";

import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { ChipRow } from "@/components/ui/ChipRow";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import { uiRadius, uiSpace, uiTypography } from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
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
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const params = useLocalSearchParams<ImportParams>();
  const { importTemplateFromUrl, workspace } = useWorkspace();
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

  useEffect(() => {
    if (!importUrl || importKey === lastImportKey) {
      if (!importUrl) {
        setStatusMessage(
          "No TrackItUp template import data was found in this route.",
        );
      }
      return;
    }

    const result = importTemplateFromUrl(importUrl, preferredMethod);
    setStatusMessage(result.message);
    setTemplateName(result.templateName ?? null);
    setLastImportKey(importKey);
  }, [
    importKey,
    importTemplateFromUrl,
    importUrl,
    lastImportKey,
    preferredMethod,
  ]);

  return (
    <ScrollView
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: "Template import" }} />

      <ScreenHero
        palette={palette}
        title="Template import"
        subtitle="Import a shared template from a deep link or a scanned QR code into the local workspace catalog."
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

      <SectionMessage
        palette={palette}
        label="Import status"
        title={
          templateName ? `Imported ${templateName}` : "Workspace catalog update"
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

      <ActionButtonRow style={styles.buttonRow}>
        <Button
          mode="contained"
          onPress={() => router.replace("/(tabs)" as never)}
          style={styles.button}
        >
          View catalog
        </Button>
        <Button
          mode="contained-tonal"
          onPress={() => router.replace("/modal" as never)}
          style={styles.button}
        >
          Open tools
        </Button>
        <Button
          mode="outlined"
          onPress={() => router.replace("/scanner" as never)}
          style={styles.button}
        >
          Scan again
        </Button>
      </ActionButtonRow>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: uiSpace.screen, paddingBottom: uiSpace.screenBottom },
  body: uiTypography.body,
  statusChipRow: {
    marginBottom: uiSpace.md,
  },
  statusChip: { borderRadius: uiRadius.pill },
  buttonRow: { gap: uiSpace.md, marginTop: uiSpace.xxs },
  button: { flexGrow: 1 },
});
