import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Button } from "react-native-paper";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
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
    [
      "methods",
      pickParam(params.methods) ?? pickParam(params.importMethods),
    ],
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
  }, [importKey, importTemplateFromUrl, importUrl, lastImportKey, preferredMethod]);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: "Template import" }} />

      <View style={styles.hero}>
        <Text style={[styles.eyebrow, { color: palette.tint }]}>TrackItUp</Text>
        <Text style={styles.title}>Template import</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>Import a shared template from a deep link or a scanned QR code into the local workspace catalog.</Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>Import status</Text>
        <Text style={[styles.body, { color: palette.muted }]}>{statusMessage}</Text>
        {templateName ? (
          <Text style={[styles.meta, { color: palette.tint }]}>Template: {templateName}</Text>
        ) : null}
        <Text style={[styles.meta, { color: palette.muted }]}>Catalog size: {workspace.templates.length} templates</Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>Import payload</Text>
        <Text style={[styles.body, { color: palette.muted }]}>
          {importUrl || "No URL or import payload was provided."}
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <Button mode="contained" onPress={() => router.replace("/(tabs)" as never)} style={styles.button}>
          View catalog
        </Button>
        <Button mode="contained-tonal" onPress={() => router.replace("/modal" as never)} style={styles.button}>
          Open tools
        </Button>
        <Button mode="outlined" onPress={() => router.replace("/scanner" as never)} style={styles.button}>
          Scan again
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  hero: { marginBottom: 18 },
  eyebrow: { fontSize: 13, fontWeight: "800", marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 10 },
  body: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 10 },
  buttonRow: { gap: 10 },
  button: { flexGrow: 1 },
});