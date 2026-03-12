import { StyleSheet, View } from "react-native";
import {
    Button,
    Chip,
    Surface,
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
import {
    buildAiDraftReviewItems,
    formatAiDraftUsageLabel,
    type AiDraftReviewItemInput,
    type AiDraftReviewUsage,
} from "@/services/ai/aiDraftReview";

import { ActionButtonRow } from "./ActionButtonRow";
import { ChipRow } from "./ChipRow";
import { SectionSurface } from "./SectionSurface";

type AiDraftReviewCardProps = {
  palette: AppPalette;
  title: string;
  draftKindLabel?: string;
  contextChips?: string[];
  summary?: string;
  consentLabel?: string;
  footerNote?: string;
  statusLabel?: string;
  modelLabel?: string;
  usage?: AiDraftReviewUsage | null;
  items: AiDraftReviewItemInput[];
  acceptLabel?: string;
  editLabel?: string;
  regenerateLabel?: string;
  emptyStateMessage?: string;
  isBusy?: boolean;
  acceptDisabled?: boolean;
  editDisabled?: boolean;
  regenerateDisabled?: boolean;
  onAccept: () => void | Promise<void>;
  onEdit?: () => void | Promise<void>;
  onRegenerate?: () => void | Promise<void>;
};

export function AiDraftReviewCard({
  palette,
  title,
  draftKindLabel = "Draft",
  contextChips = [],
  summary,
  consentLabel,
  footerNote,
  statusLabel = "Review required",
  modelLabel,
  usage,
  items,
  acceptLabel = "Apply draft",
  editLabel = "Keep editing",
  regenerateLabel = "Regenerate",
  emptyStateMessage = "No draft details are available yet.",
  isBusy = false,
  acceptDisabled = false,
  editDisabled = false,
  regenerateDisabled = false,
  onAccept,
  onEdit,
  onRegenerate,
}: AiDraftReviewCardProps) {
  const theme = useTheme<MD3Theme>();
  const reviewItems = buildAiDraftReviewItems(items);
  const usageLabel = formatAiDraftUsageLabel(usage);
  const visibleContextChips = contextChips
    .map((item) => item.trim())
    .filter(
      (item, index, items) => item.length > 0 && items.indexOf(item) === index,
    )
    .slice(0, 3);

  return (
    <SectionSurface palette={palette} label="AI draft" title={title}>
      <ChipRow style={styles.chipRow}>
        <Chip compact style={styles.chip} icon="sparkles">
          {statusLabel}
        </Chip>
        <Chip compact style={styles.chip}>
          {draftKindLabel}
        </Chip>
        {modelLabel ? (
          <Chip compact style={styles.chip}>
            {modelLabel}
          </Chip>
        ) : null}
        {usageLabel ? (
          <Chip compact style={styles.chip}>
            {usageLabel}
          </Chip>
        ) : null}
        {visibleContextChips.map((item) => (
          <Chip key={item} compact style={styles.chip}>
            {item}
          </Chip>
        ))}
      </ChipRow>

      {summary ? (
        <Text style={[styles.summary, { color: theme.colors.onSurface }]}>
          {summary}
        </Text>
      ) : null}

      {consentLabel ? (
        <Text style={[styles.meta, { color: palette.muted }]}>
          {consentLabel}
        </Text>
      ) : null}

      {reviewItems.length === 0 ? (
        <Text style={[styles.meta, { color: palette.muted }]}>
          {emptyStateMessage}
        </Text>
      ) : (
        <View style={styles.list}>
          {reviewItems.map((item) => (
            <Surface
              key={item.key}
              style={[
                styles.itemCard,
                {
                  backgroundColor: theme.colors.elevation.level1,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
              elevation={0}
            >
              <Text style={[styles.itemLabel, { color: theme.colors.primary }]}>
                {item.label}
              </Text>
              {item.valueLines ? (
                <View style={styles.valueList}>
                  {item.valueLines.map((line) => (
                    <Text
                      key={`${item.key}-${line}`}
                      style={[
                        styles.itemValue,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      • {line}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text
                  style={[styles.itemValue, { color: theme.colors.onSurface }]}
                >
                  {item.valueText}
                </Text>
              )}
            </Surface>
          ))}
        </View>
      )}

      {footerNote ? (
        <Text style={[styles.meta, { color: palette.muted }]}>
          {footerNote}
        </Text>
      ) : null}

      <ActionButtonRow style={styles.actions}>
        {onEdit ? (
          <Button
            mode="outlined"
            onPress={() => void onEdit()}
            style={styles.button}
            disabled={isBusy || editDisabled}
          >
            {editLabel}
          </Button>
        ) : null}
        {onRegenerate ? (
          <Button
            mode="outlined"
            onPress={() => void onRegenerate()}
            style={styles.button}
            disabled={isBusy || regenerateDisabled}
          >
            {regenerateLabel}
          </Button>
        ) : null}
        <Button
          mode="contained"
          onPress={() => void onAccept()}
          style={styles.button}
          loading={isBusy}
          disabled={isBusy || acceptDisabled}
        >
          {acceptLabel}
        </Button>
      </ActionButtonRow>
    </SectionSurface>
  );
}

const styles = StyleSheet.create({
  chipRow: { marginTop: uiSpace.xs, marginBottom: uiSpace.md },
  chip: { borderRadius: uiRadius.pill },
  summary: uiTypography.body,
  meta: { ...uiTypography.bodySmall, marginTop: uiSpace.md },
  list: { marginTop: uiSpace.lg, gap: uiSpace.md },
  itemCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.lg,
    padding: uiSpace.lg,
    gap: uiSpace.xs,
  },
  itemLabel: uiTypography.label,
  itemValue: uiTypography.body,
  valueList: { gap: uiSpace.xs },
  actions: { marginTop: uiSpace.xl },
  button: { alignSelf: "flex-start" },
});
