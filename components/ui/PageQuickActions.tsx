import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import { uiBorder, uiRadius, uiSpace, uiTypography } from "@/constants/UiTokens";

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

export function PageQuickActions({
  palette,
  actions,
  title = "Keep this page moving",
  description,
  style,
}: PageQuickActionsProps) {
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
          const accentColor = action.accentColor ?? palette.tint;

          return (
            <Pressable
              key={action.id}
              accessibilityRole="button"
              disabled={action.disabled}
              onPress={() => void action.onPress()}
              style={({ pressed }) => [
                styles.pressable,
                { opacity: action.disabled ? 0.55 : pressed ? 0.94 : 1 },
              ]}
            >
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.cardAlt,
                    borderColor: `${accentColor}33`,
                  },
                ]}
              >
                <Text style={styles.label}>{action.label}</Text>
                <Text style={[styles.hint, { color: palette.muted }]}>
                  {action.hint}
                </Text>
              </View>
            </Pressable>
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
  },
  card: {
    minHeight: 104,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.lg,
    padding: uiSpace.lg,
    gap: uiSpace.sm,
  },
  label: uiTypography.bodyStrong,
  hint: uiTypography.bodySmall,
});