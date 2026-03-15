import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
    Button,
    Checkbox,
    Chip,
    Surface,
    TextInput,
    useTheme,
    type MD3Theme,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import {
    uiBorder,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import type { AiActionPlan } from "@/types/trackitup";

import { ActionButtonRow } from "./ActionButtonRow";
import { ChipRow } from "./ChipRow";
import { SectionSurface } from "./SectionSurface";

type AiActionPlanReviewCardProps = {
  palette: AppPalette;
  plan: AiActionPlan;
  busy?: boolean;
  onToggleStepApproval: (stepId: string, approved: boolean) => void;
  onReject: () => void;
  onApprove: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseSeedFormValues(executionNote?: string) {
  if (!executionNote?.startsWith("seed:")) return undefined;
  try {
    const parsed = JSON.parse(executionNote.slice("seed:".length));
    if (!isRecord(parsed) || !isRecord(parsed.formValues)) return undefined;
    return parsed.formValues;
  } catch {
    return undefined;
  }
}

function formatFormValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join(", ");
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (isRecord(value)) return JSON.stringify(value);
  return "";
}

function buildFormValueLines(executionNote?: string) {
  const formValues = parseSeedFormValues(executionNote);
  if (!formValues) return [];

  const orderedKeys = [
    "occurredAt",
    "startDate",
    "timezone",
    "spaceId",
    "reminderId",
    "note",
    "tags",
    "assetIds",
    "scheduleType",
    "scheduleTimes",
    "interval",
    "daysOfWeek",
    "dayOfMonth",
    "nthWeekday",
    "proofRequired",
  ];

  return orderedKeys
    .filter((key) => formValues[key] !== undefined)
    .map((key) => {
      const formattedValue = formatFormValue(formValues[key]);
      if (!formattedValue) return null;
      return `${key}: ${formattedValue}`;
    })
    .filter((line): line is string => Boolean(line));
}

function formatTokenUsageLabel(usage: AiActionPlan["transcript"]["usage"]) {
  if (!usage) return null;
  const inTokens = usage.inputTokens;
  const outTokens = usage.outputTokens;
  const totalTokens = usage.totalTokens;

  if (typeof inTokens === "number" && typeof outTokens === "number") {
    return `${inTokens} in • ${outTokens} out`;
  }

  if (typeof totalTokens === "number") {
    return `${totalTokens} total`;
  }

  return null;
}

export function AiActionPlanReviewCard({
  palette,
  plan,
  busy = false,
  onToggleStepApproval,
  onReject,
  onApprove,
}: AiActionPlanReviewCardProps) {
  const theme = useTheme<MD3Theme>();
  const [destructiveConfirmText, setDestructiveConfirmText] = useState("");

  const approvedStepCount = useMemo(
    () => plan.steps.filter((step) => step.approved).length,
    [plan.steps],
  );
  const destructiveApprovedSteps = useMemo(
    () =>
      plan.steps.filter(
        (step) => step.approved && step.riskLevel === "destructive",
      ),
    [plan.steps],
  );
  const usageLabel = formatTokenUsageLabel(plan.transcript.usage);
  const requiresDestructiveConfirmation = destructiveApprovedSteps.length > 0;
  const isDestructiveConfirmationSatisfied =
    !requiresDestructiveConfirmation ||
    destructiveConfirmText.trim().toUpperCase() === "EXECUTE";

  return (
    <SectionSurface
      palette={palette}
      label="Live dictation plan"
      title="Review and approve AI action plan"
    >
      <ChipRow style={styles.chipRow}>
        <Chip compact style={styles.chip} icon="shield-check">
          Transparent review required
        </Chip>
        <Chip compact style={styles.chip}>
          {approvedStepCount}/{plan.steps.length} approved
        </Chip>
        <Chip compact style={styles.chip}>
          {plan.transcript.modelId}
        </Chip>
        {usageLabel ? (
          <Chip compact style={styles.chip}>
            {usageLabel}
          </Chip>
        ) : null}
      </ChipRow>

      <Text style={styles.sectionTitle}>Raw transcript</Text>
      <Text style={[styles.copy, { color: theme.colors.onSurface }]}>
        {plan.transcript.transcript}
      </Text>

      <Text style={styles.sectionTitle}>Interpreted intent</Text>
      <Text style={[styles.copy, { color: theme.colors.onSurface }]}>
        {plan.transcript.interpretedIntentSummary}
      </Text>

      <Text style={styles.sectionTitle}>Data sent to AI</Text>
      <Text style={[styles.copy, { color: palette.muted }]}>
        {plan.transcript.dataSentLabel}
      </Text>

      <Text style={styles.sectionTitle}>Exact action list</Text>
      <View style={styles.stepList}>
        {plan.steps.map((step) =>
          (() => {
            const formValueLines = buildFormValueLines(step.executionNote);
            return (
              <Surface
                key={step.id}
                style={[
                  styles.stepCard,
                  {
                    backgroundColor: theme.colors.elevation.level1,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
                elevation={0}
              >
                <View style={styles.stepHeader}>
                  <View style={styles.stepHeaderCopy}>
                    <Text style={styles.stepTitle}>
                      {step.stepNumber}. {step.title}
                    </Text>
                    <Text style={[styles.meta, { color: palette.muted }]}>
                      {step.reason}
                    </Text>
                    {step.targetLabel ? (
                      <Text style={[styles.meta, { color: palette.muted }]}>
                        Target: {step.targetLabel}
                      </Text>
                    ) : null}
                    {formValueLines.length > 0 ? (
                      <View style={styles.formValueList}>
                        <Text style={[styles.meta, { color: palette.muted }]}>
                          Transcript form values
                        </Text>
                        {formValueLines.map((line) => (
                          <Text
                            key={line}
                            style={[styles.meta, { color: palette.muted }]}
                          >
                            • {line}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <Checkbox
                    status={step.approved ? "checked" : "unchecked"}
                    onPress={() =>
                      onToggleStepApproval(step.id, !step.approved)
                    }
                    disabled={busy}
                  />
                </View>
                <ChipRow>
                  <Chip compact style={styles.chip}>
                    {step.actionClass}
                  </Chip>
                  <Chip compact style={styles.chip}>
                    Risk: {step.riskLevel}
                  </Chip>
                </ChipRow>
              </Surface>
            );
          })(),
        )}
      </View>

      {requiresDestructiveConfirmation ? (
        <View style={styles.destructiveBox}>
          <Text style={[styles.meta, { color: theme.colors.error }]}>
            Destructive actions are selected. Type EXECUTE to confirm.
          </Text>
          <TextInput
            mode="outlined"
            value={destructiveConfirmText}
            onChangeText={setDestructiveConfirmText}
            placeholder="Type EXECUTE"
            autoCapitalize="characters"
            editable={!busy}
          />
        </View>
      ) : null}

      <ActionButtonRow style={styles.actionRow}>
        <Button mode="outlined" onPress={onReject} disabled={busy}>
          Reject plan
        </Button>
        <Button
          mode="contained"
          onPress={onApprove}
          loading={busy}
          disabled={
            busy ||
            approvedStepCount === 0 ||
            !isDestructiveConfirmationSatisfied
          }
        >
          Execute approved steps
        </Button>
      </ActionButtonRow>
    </SectionSurface>
  );
}

const styles = StyleSheet.create({
  chipRow: { marginTop: uiSpace.xs, marginBottom: uiSpace.md },
  chip: { borderRadius: uiRadius.pill },
  sectionTitle: {
    ...uiTypography.label,
    marginTop: uiSpace.md,
    marginBottom: uiSpace.xs,
  },
  copy: uiTypography.body,
  stepList: { marginTop: uiSpace.sm, gap: uiSpace.md },
  stepCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.lg,
    padding: uiSpace.lg,
    gap: uiSpace.sm,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: uiSpace.md,
  },
  stepHeaderCopy: { flex: 1, gap: uiSpace.xs },
  stepTitle: uiTypography.titleMd,
  meta: uiTypography.bodySmall,
  formValueList: { marginTop: uiSpace.xs, gap: 2 },
  destructiveBox: { marginTop: uiSpace.lg, gap: uiSpace.sm },
  actionRow: { marginTop: uiSpace.lg },
});
