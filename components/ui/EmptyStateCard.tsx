import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Surface, useTheme, type MD3Theme } from "react-native-paper";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import { uiBorder, uiRadius, uiSpace, uiTypography } from "@/constants/UiTokens";

import { CardActionPill } from "./CardActionPill";

type EmptyStateIconName = ComponentProps<typeof SymbolView>["name"];

type EmptyStateCardProps = {
  palette: AppPalette;
  icon: EmptyStateIconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  actionAccentColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function EmptyStateCard({
  palette,
  icon,
  title,
  message,
  actionLabel,
  onAction,
  actionAccentColor,
  style,
}: EmptyStateCardProps) {
  const theme = useTheme<MD3Theme>();

  return (
    <Surface
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.elevation.level1,
          borderColor: theme.colors.outlineVariant,
        },
        style,
      ]}
      elevation={0}
    >
      <View
        style={[
          styles.iconBadge,
          {
            backgroundColor: palette.accentSoft,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <SymbolView name={icon} size={18} tintColor={palette.tint} />
      </View>
      <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <View style={styles.actionRow}>
          <CardActionPill
            label={actionLabel}
            onPress={onAction}
            accentColor={actionAccentColor ?? palette.tint}
          />
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: uiRadius.pill,
    borderWidth: uiBorder.hairline,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: uiSpace.md,
  },
  title: {
    ...uiTypography.titleMd,
    marginBottom: uiSpace.xs,
  },
  message: {
    ...uiTypography.body,
    lineHeight: 21,
  },
  actionRow: {
    marginTop: uiSpace.lg,
    alignItems: "flex-end",
  },
});