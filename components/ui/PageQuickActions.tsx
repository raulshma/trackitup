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

          return (
            <Surface
              key={action.id}
              style={[
                styles.pressable,
                styles.card,
                {
                  backgroundColor: theme.colors.elevation.level1,
                  borderColor: action.disabled
                    ? theme.colors.outlineVariant
                    : `${accentColor}33`,
                  opacity: action.disabled ? 0.6 : 1,
                },
              ]}
              elevation={1}
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
    borderRadius: uiRadius.lg,
    overflow: "hidden",
  },
  card: {
    minHeight: 116,
  },
  touchable: {
    flex: 1,
  },
  cardContent: {
    minHeight: 116,
    padding: uiSpace.lg,
    gap: uiSpace.sm,
  },
  accentBar: {
    width: 40,
    height: 4,
    borderRadius: uiRadius.pill,
    marginBottom: uiSpace.xs,
  },
  label: uiTypography.bodyStrong,
  hint: uiTypography.bodySmall,
});
