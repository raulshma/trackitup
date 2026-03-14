import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Surface, useTheme, type MD3Theme } from "react-native-paper";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import {
    uiBorder,
    uiMotion,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";

import { MotionPressable, MotionView } from "./Motion";
import { SectionSurface } from "./SectionSurface";

export type PageQuickActionItem = {
  id: string;
  label: string;
  hint: string;
  onPress: () => void | Promise<void>;
  accentColor?: string;
  disabled?: boolean;
};

type PageQuickActionsProps = {
  palette: AppPalette;
  actions: PageQuickActionItem[];
  title?: string;
  description?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

function formatQuickActionCtaLabel(label: string): string {
  const normalized = label.trim().toLowerCase();

  if (normalized.startsWith("open ")) return "Open";
  if (normalized.startsWith("scan") || normalized.includes("camera")) {
    return "Scan";
  }
  if (normalized.startsWith("sync")) return "Sync";
  if (normalized.startsWith("save")) return "Save";
  if (normalized.startsWith("import")) return "Import";
  if (normalized.startsWith("record") || normalized.startsWith("capture")) {
    return "Record";
  }
  if (normalized.startsWith("create") || normalized.startsWith("add ")) {
    return "Create";
  }
  if (normalized.startsWith("allow")) return "Allow";
  if (normalized.includes("filter")) return "Filter";
  if (normalized.startsWith("show ")) return "Show";
  if (normalized.startsWith("review")) return "Review";

  return "Open";
}

export function PageQuickActions({
  palette,
  actions,
  title = "Keep this page moving",
  description,
  compact = false,
  style,
}: PageQuickActionsProps) {
  const theme = useTheme<MD3Theme>();

  if (actions.length === 0) {
    return null;
  }

  return (
    <SectionSurface
      palette={palette}
      label="Quick actions"
      title={title}
      style={style}
      motionDelay={uiMotion.stagger * 3}
    >
      {description ? (
        <Text
          style={[
            styles.description,
            compact ? styles.descriptionCompact : null,
            { color: palette.muted },
          ]}
        >
          {description}
        </Text>
      ) : null}
      <View style={[styles.grid, compact ? styles.gridCompact : null]}>
        {actions.map((action, index) => {
          const accentColor = action.accentColor ?? theme.colors.primary;
          const ctaLabel = formatQuickActionCtaLabel(action.label);

          return (
            <MotionView
              key={action.id}
              delay={uiMotion.stagger * (index + 1)}
              style={[styles.gridItem, compact ? styles.gridItemCompact : null]}
            >
              <Surface
                style={[
                  styles.pressable,
                  styles.card,
                  compact ? styles.cardCompact : null,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: action.disabled
                      ? theme.colors.outlineVariant
                      : `${accentColor}26`,
                    opacity: action.disabled ? 0.6 : 1,
                  },
                ]}
                elevation={0}
              >
                <MotionPressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: action.disabled }}
                  disabled={action.disabled}
                  onPress={() => void action.onPress()}
                  style={styles.touchable}
                >
                  <View
                    style={[styles.ambientLayer, { pointerEvents: "none" }]}
                  >
                    <View
                      style={[
                        styles.accentGlow,
                        { backgroundColor: `${accentColor}14` },
                      ]}
                    />
                  </View>
                  <View
                    style={[
                      styles.cardContent,
                      compact ? styles.cardContentCompact : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.accentBar,
                        compact ? styles.accentBarCompact : null,
                        { backgroundColor: accentColor },
                      ]}
                    />
                    <View
                      style={[
                        styles.copyColumn,
                        compact ? styles.copyColumnCompact : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.label,
                          compact ? styles.labelCompact : null,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        {action.label}
                      </Text>
                      <Text
                        style={[
                          styles.hint,
                          compact ? styles.hintCompact : null,
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {action.hint}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.cardFooter,
                        compact ? styles.cardFooterCompact : null,
                      ]}
                    >
                      <View
                        style={[
                          styles.actionButton,
                          compact ? styles.actionButtonCompact : null,
                          {
                            backgroundColor: action.disabled
                              ? theme.colors.elevation.level1
                              : `${accentColor}14`,
                            borderColor: action.disabled
                              ? theme.colors.outlineVariant
                              : `${accentColor}26`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.actionButtonLabel,
                            compact ? styles.actionButtonLabelCompact : null,
                            {
                              color: action.disabled
                                ? theme.colors.onSurfaceVariant
                                : accentColor,
                            },
                          ]}
                        >
                          {ctaLabel}
                        </Text>
                      </View>
                    </View>
                  </View>
                </MotionPressable>
              </Surface>
            </MotionView>
          );
        })}
      </View>
    </SectionSurface>
  );
}

const styles = StyleSheet.create({
  description: {
    ...uiTypography.body,
    marginBottom: uiSpace.lg,
  },
  descriptionCompact: {
    marginBottom: uiSpace.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
  },
  gridCompact: {
    gap: uiSpace.sm,
  },
  gridItem: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 220,
  },
  gridItemCompact: {
    flexBasis: 180,
    minWidth: 168,
  },
  pressable: {
    flexGrow: 1,
    flexBasis: 220,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    overflow: "hidden",
  },
  card: {
    minHeight: 118,
  },
  cardCompact: {
    minHeight: 94,
  },
  touchable: {
    flex: 1,
    overflow: "hidden",
  },
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  accentGlow: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: uiRadius.pill,
    top: -42,
    right: -28,
  },
  cardContent: {
    flex: 1,
    minHeight: 118,
    padding: uiSpace.surface,
  },
  cardContentCompact: {
    minHeight: 94,
    padding: uiSpace.lg,
  },
  accentBar: {
    width: 36,
    height: 4,
    borderRadius: uiRadius.pill,
    marginBottom: uiSpace.lg,
  },
  accentBarCompact: {
    width: 28,
    marginBottom: uiSpace.sm,
  },
  copyColumn: {
    gap: uiSpace.xs,
  },
  copyColumnCompact: {
    gap: 2,
  },
  cardFooter: {
    marginTop: uiSpace.md,
    alignItems: "flex-end",
  },
  cardFooterCompact: {
    marginTop: uiSpace.sm,
  },
  actionButton: {
    minWidth: 74,
    borderRadius: uiRadius.pill,
    borderWidth: uiBorder.hairline,
    paddingHorizontal: uiSpace.lg,
    paddingVertical: uiSpace.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonCompact: {
    minWidth: 64,
    paddingHorizontal: uiSpace.md,
    paddingVertical: uiSpace.xs,
  },
  actionButtonLabel: {
    ...uiTypography.label,
    textTransform: "none",
  },
  actionButtonLabelCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  label: uiTypography.titleSm,
  labelCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  hint: uiTypography.bodySmall,
  hintCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
});
