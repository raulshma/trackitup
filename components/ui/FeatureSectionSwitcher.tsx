import { SymbolView } from "expo-symbols";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Surface, useTheme, type MD3Theme } from "react-native-paper";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import {
    uiMotion,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { MotionPressable, MotionView } from "./Motion";
import { SectionSurface } from "./SectionSurface";

type SectionIconName = React.ComponentProps<typeof SymbolView>["name"];

export type FeatureSectionItem<T extends string> = {
  id: T;
  label: string;
  hint: string;
  meta: string;
  badges: string[];
  icon: SectionIconName;
  accentColor?: string;
};

type FeatureSectionSwitcherProps<T extends string> = {
  palette: AppPalette;
  label: string;
  title: string;
  description: string;
  items: FeatureSectionItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
};

export function FeatureSectionSwitcher<T extends string>({
  palette,
  label,
  title,
  description,
  items,
  activeId,
  onChange,
}: FeatureSectionSwitcherProps<T>) {
  const theme = useTheme<MD3Theme>();
  const activeItem =
    items.find((item) => item.id === activeId) ?? items[0] ?? null;

  return (
    <SectionSurface
      palette={palette}
      label={label}
      title={title}
      motionDelay={uiMotion.stagger * 2}
    >
      <Text style={[styles.description, { color: palette.muted }]}>
        {description}
      </Text>
      <View style={styles.sectionSwitcherGrid}>
        {items.map((item, index) => {
          const isActive = activeId === item.id;
          const accentColor = item.accentColor ?? theme.colors.primary;

          return (
            <MotionView
              key={item.id}
              delay={uiMotion.stagger * (index + 1)}
              style={styles.sectionSwitchMotionWrap}
            >
              <MotionPressable
                accessibilityLabel={`Show ${item.label} section`}
                onPress={() => onChange(item.id)}
                style={[
                  styles.sectionSwitchCard,
                  {
                    backgroundColor: isActive
                      ? theme.colors.primaryContainer
                      : theme.colors.elevation.level1,
                    borderColor: isActive
                      ? accentColor
                      : theme.colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.sectionSwitchHeader}>
                  <View
                    style={[
                      styles.sectionSwitchIconWrap,
                      {
                        backgroundColor: isActive
                          ? theme.colors.elevation.level1
                          : theme.colors.elevation.level2,
                        borderColor: isActive
                          ? accentColor
                          : theme.colors.outlineVariant,
                      },
                    ]}
                  >
                    <SymbolView
                      name={item.icon}
                      size={18}
                      tintColor={
                        isActive ? theme.colors.onPrimaryContainer : accentColor
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.sectionSwitchTitle,
                      {
                        color: isActive
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurface,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
                <View style={styles.sectionSwitchBadgeRow}>
                  {item.badges.map((badge) => (
                    <View
                      key={`${item.id}-${badge}`}
                      style={[
                        styles.sectionSwitchBadge,
                        {
                          backgroundColor: isActive
                            ? theme.colors.elevation.level1
                            : theme.colors.elevation.level2,
                          borderColor: isActive
                            ? accentColor
                            : theme.colors.outlineVariant,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sectionSwitchBadgeLabel,
                          {
                            color: isActive
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {badge}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text
                  style={[
                    styles.sectionSwitchHint,
                    {
                      color: isActive
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {item.hint}
                </Text>
                <Text
                  style={[
                    styles.sectionSwitchMeta,
                    {
                      color: isActive
                        ? theme.colors.onPrimaryContainer
                        : accentColor,
                    },
                  ]}
                >
                  {item.meta}
                </Text>
              </MotionPressable>
            </MotionView>
          );
        })}
      </View>

      {activeItem ? (
        <MotionView key={activeItem.id} delay={uiMotion.stagger}>
          <Surface
            style={[
              styles.activeSectionCard,
              {
                backgroundColor: theme.colors.elevation.level2,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
            elevation={1}
          >
            <View style={styles.activeSectionSummaryRow}>
              <View
                style={[
                  styles.activeSectionIconWrap,
                  {
                    backgroundColor: theme.colors.elevation.level3,
                    borderColor: activeItem.accentColor ?? theme.colors.primary,
                  },
                ]}
              >
                <SymbolView
                  name={activeItem.icon}
                  size={18}
                  tintColor={activeItem.accentColor ?? theme.colors.primary}
                />
              </View>
              <Text style={styles.widgetListTitle}>
                {activeItem.label} view
              </Text>
            </View>
            <Text style={[styles.widgetShortcutMeta, { color: palette.muted }]}>
              {activeItem.hint}. Use the section switcher above to move between
              this page&apos;s feature clusters without dragging every tool into
              view at the same time.
            </Text>
          </Surface>
        </MotionView>
      ) : null}
    </SectionSurface>
  );
}

const styles = StyleSheet.create({
  description: {
    ...uiTypography.body,
  },
  sectionSwitcherGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  sectionSwitchCard: {
    flexGrow: 1,
    flexBasis: 148,
    minHeight: 116,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  sectionSwitchMotionWrap: {
    flexGrow: 1,
    flexBasis: 148,
    minWidth: 148,
  },
  sectionSwitchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionSwitchIconWrap: {
    width: 34,
    height: 34,
    borderRadius: uiRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionSwitchTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  sectionSwitchBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionSwitchBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: uiRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionSwitchBadgeLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  sectionSwitchHint: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  sectionSwitchMeta: {
    fontSize: 12,
    fontWeight: "700",
  },
  activeSectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 6,
    marginTop: uiSpace.lg,
  },
  activeSectionSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  activeSectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: uiRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  widgetListTitle: {
    ...uiTypography.bodyStrong,
  },
  widgetShortcutMeta: {
    ...uiTypography.support,
  },
});
