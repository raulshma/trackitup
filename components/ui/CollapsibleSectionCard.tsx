import { useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { TouchableRipple, useTheme, type MD3Theme } from "react-native-paper";

import { Text } from "@/components/Themed";
import {
    uiBorder,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";

type CollapsibleSectionCardProps = {
  title: string;
  description?: string;
  badge?: string;
  defaultExpanded?: boolean;
  accentColor?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function CollapsibleSectionCard({
  title,
  description,
  badge,
  defaultExpanded = false,
  accentColor,
  children,
  style,
}: CollapsibleSectionCardProps) {
  const theme = useTheme<MD3Theme>();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const tint = accentColor ?? theme.colors.primary;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        },
        style,
      ]}
    >
      <TouchableRipple
        accessibilityRole="button"
        onPress={() => setIsExpanded((current) => !current)}
        rippleColor={`${tint}14`}
        style={styles.touchable}
      >
        <View style={styles.header}>
          <View style={styles.copyColumn}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
            {description ? (
              <Text
                style={[
                  styles.description,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {description}
              </Text>
            ) : null}
          </View>
          <View style={styles.metaColumn}>
            {badge ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: `${tint}12`,
                    borderColor: `${tint}24`,
                  },
                ]}
              >
                <Text style={[styles.badgeLabel, { color: tint }]}>
                  {badge}
                </Text>
              </View>
            ) : null}
            <View
              style={[
                styles.toggleBadge,
                {
                  backgroundColor: theme.colors.elevation.level1,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <Text
                style={[
                  styles.toggleLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {isExpanded ? "Hide" : "Show"}
              </Text>
            </View>
          </View>
        </View>
      </TouchableRipple>
      {isExpanded ? (
        <View
          style={[
            styles.body,
            {
              borderTopColor: theme.colors.outlineVariant,
            },
          ]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    overflow: "hidden",
  },
  touchable: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: uiSpace.lg,
    paddingHorizontal: uiSpace.surface,
    paddingVertical: uiSpace.lg,
  },
  copyColumn: {
    flex: 1,
    gap: uiSpace.xs,
  },
  metaColumn: {
    alignItems: "flex-end",
    gap: uiSpace.sm,
  },
  title: {
    ...uiTypography.titleMd,
  },
  description: {
    ...uiTypography.bodySmall,
    lineHeight: 18,
  },
  badge: {
    borderRadius: uiRadius.pill,
    borderWidth: uiBorder.hairline,
    paddingHorizontal: uiSpace.md,
    paddingVertical: uiSpace.xs,
  },
  badgeLabel: {
    ...uiTypography.chip,
    textTransform: "none",
  },
  toggleBadge: {
    borderRadius: uiRadius.pill,
    borderWidth: uiBorder.hairline,
    paddingHorizontal: uiSpace.md,
    paddingVertical: uiSpace.xs,
  },
  toggleLabel: {
    ...uiTypography.label,
    textTransform: "none",
  },
  body: {
    borderTopWidth: uiBorder.hairline,
    padding: uiSpace.surface,
    gap: uiSpace.lg,
  },
});
