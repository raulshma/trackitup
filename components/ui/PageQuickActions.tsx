import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import {
    Surface,
    TouchableRipple,
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
    >
      {description ? (
        <Text style={[styles.description, { color: palette.muted }]}>
          {description}
        </Text>
      ) : null}
      <View style={styles.grid}>
        {actions.map((action) => {
          const accentColor = action.accentColor ?? theme.colors.primary;
          const ctaLabel = formatQuickActionCtaLabel(action.label);

          return (
            <Surface
              key={action.id}
              style={[
                styles.pressable,
                styles.card,
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
              <TouchableRipple
                accessibilityRole="button"
                accessibilityState={{ disabled: action.disabled }}
                borderless={false}
                disabled={action.disabled}
                onPress={() => void action.onPress()}
                rippleColor={`${accentColor}1A`}
                style={styles.touchable}
              >
                <View style={styles.cardContent}>
                  <View
                    style={[styles.accentBar, { backgroundColor: accentColor }]}
                  />
                  <View style={styles.copyColumn}>
                    <Text
                      style={[styles.label, { color: theme.colors.onSurface }]}
                    >
                      {action.label}
                    </Text>
                    <Text
                      style={[
                        styles.hint,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {action.hint}
                    </Text>
                  </View>
                  <View style={styles.cardFooter}>
                    <View
                      style={[
                        styles.actionButton,
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
              </TouchableRipple>
            </Surface>
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
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
  touchable: {
    flex: 1,
  },
  cardContent: {
    flex: 1,
    minHeight: 118,
    padding: uiSpace.surface,
  },
  accentBar: {
    width: 36,
    height: 4,
    borderRadius: uiRadius.pill,
    marginBottom: uiSpace.lg,
  },
  copyColumn: {
    gap: uiSpace.xs,
  },
  cardFooter: {
    marginTop: uiSpace.md,
    alignItems: "flex-end",
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
  actionButtonLabel: {
    ...uiTypography.label,
    textTransform: "none",
  },
  label: uiTypography.titleSm,
  hint: uiTypography.bodySmall,
});
