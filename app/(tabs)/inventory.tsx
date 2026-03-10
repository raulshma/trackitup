import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Button, Chip, Surface } from "react-native-paper";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
    uiBorder,
    uiElevation,
    uiRadius,
    uiShadow,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount);
}

export default function InventoryScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const { workspace } = useWorkspace();

  const assetCards = useMemo(() => {
    const spacesById = new Map(
      workspace.spaces.map((space) => [space.id, space] as const),
    );

    return workspace.assets.map((asset) => {
      const expenseTotal = workspace.expenses
        .filter((expense) => expense.assetId === asset.id)
        .reduce(
          (total, expense) => total + expense.amount,
          asset.purchasePrice ?? 0,
        );
      const relatedLogCount = workspace.logs.filter((log) =>
        log.assetIds?.includes(asset.id),
      ).length;

      return {
        ...asset,
        expenseTotal,
        relatedLogCount,
        spaceName: spacesById.get(asset.spaceId)?.name ?? "Unknown space",
      };
    });
  }, [workspace.assets, workspace.expenses, workspace.logs, workspace.spaces]);

  const totalOwnership = workspace.expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const inventoryHighlights = [
    `${assetCards.length} tracked assets`,
    `${workspace.expenses.length} expense entries`,
    `${workspace.logs.filter((log) => (log.assetIds ?? []).length > 0).length} linked logs`,
  ];

  return (
    <ScrollView
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={styles.content}
    >
      <Surface
        style={[styles.header, paletteStyles.heroSurface]}
        elevation={uiElevation.hero}
      >
        <View style={styles.headerBadgeRow}>
          <Chip
            compact
            style={[styles.headerBadge, paletteStyles.cardChipSurface]}
            textStyle={[styles.headerBadgeLabel, paletteStyles.tintText]}
          >
            Inventory
          </Chip>
          <Chip
            compact
            style={[styles.headerBadge, paletteStyles.accentChipSurface]}
            textStyle={styles.headerBadgeLabel}
          >
            {formatCurrency(totalOwnership)} total
          </Chip>
        </View>
        <Text style={styles.title}>Inventory & lifecycle</Text>
        <Text style={[styles.subtitle, paletteStyles.mutedText]}>
          Keep hardware, supplies, and maintenance context in one place with
          clearer ownership costs, scan access, and lifecycle visibility.
        </Text>
        <View style={styles.highlightRow}>
          {inventoryHighlights.map((item) => (
            <Chip
              key={item}
              style={[styles.highlightPill, paletteStyles.cardChipSurface]}
              textStyle={styles.highlightLabel}
            >
              {item}
            </Chip>
          ))}
        </View>
      </Surface>

      <Surface
        style={[styles.summaryCard, paletteStyles.cardSurface]}
        elevation={uiElevation.card}
      >
        <Text style={styles.summaryTitle}>Tracked ownership cost</Text>
        <Text style={styles.summaryValue}>
          {formatCurrency(totalOwnership)}
        </Text>
        <Text style={[styles.summaryCopy, paletteStyles.mutedText]}>
          {workspace.expenses.length} expense entries linked to assets and
          recurring care logs.
        </Text>
        <Button
          mode="contained"
          onPress={() => router.push("/scanner" as never)}
          style={styles.scanButton}
        >
          Scan barcode / QR
        </Button>
      </Surface>

      {assetCards.length === 0 ? (
        <View
          style={[
            styles.card,
            paletteStyles.raisedCardSurface,
            { borderLeftColor: palette.border },
          ]}
        >
          <Text style={styles.cardTitle}>No tracked assets yet</Text>
          <Text style={[styles.copy, paletteStyles.mutedText]}>
            Asset records will appear here once real workspace data is synced,
            imported, or captured on this device.
          </Text>
        </View>
      ) : (
        assetCards.map((asset) => (
          <View
            key={asset.id}
            style={[
              styles.card,
              paletteStyles.raisedCardSurface,
              { borderLeftColor: palette.tint },
            ]}
          >
            <Text style={styles.cardTitle}>{asset.name}</Text>
            <Text style={[styles.meta, { color: palette.tint }]}>
              {asset.spaceName} • {asset.category} •{" "}
              {asset.status.toUpperCase()}
            </Text>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              {asset.note}
            </Text>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Purchase: {asset.purchaseDate ?? "n/a"} •{" "}
              {formatCurrency(asset.purchasePrice ?? 0)}
            </Text>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Warranty: {asset.warrantyExpiresAt ?? "n/a"}
              {asset.warrantyNote ? ` • ${asset.warrantyNote}` : ""}
            </Text>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Linked logs: {asset.relatedLogCount} • Ownership cost:{" "}
              {formatCurrency(asset.expenseTotal)}
            </Text>
            {asset.barcodeValue || asset.qrCodeValue ? (
              <Text style={[styles.copy, paletteStyles.mutedText]}>
                Codes: {asset.barcodeValue ?? asset.qrCodeValue}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: uiSpace.screen,
    paddingBottom: uiSpace.screenBottomTabs,
    gap: uiSpace.xxl,
  },
  header: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.hero,
    padding: uiSpace.hero,
  },
  headerBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
    marginBottom: uiSpace.xl,
  },
  headerBadge: {
    borderRadius: uiRadius.pill,
  },
  headerBadgeLabel: uiTypography.chip,
  title: { ...uiTypography.heroTitle, marginBottom: uiSpace.sm },
  subtitle: uiTypography.subtitle,
  highlightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
    marginTop: uiSpace.surface,
  },
  highlightPill: {
    borderRadius: uiRadius.md,
  },
  highlightLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  summaryCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.screen,
  },
  summaryTitle: { ...uiTypography.titleMd, marginBottom: 6 },
  summaryValue: { ...uiTypography.valueLg, marginBottom: 6 },
  summaryCopy: uiTypography.body,
  scanButton: { marginTop: uiSpace.xl },
  card: {
    borderWidth: uiBorder.standard,
    borderLeftWidth: 5,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    marginBottom: uiSpace.lg,
    ...uiShadow.raisedCard,
    elevation: uiElevation.raisedCard,
  },
  cardTitle: { ...uiTypography.titleSection, marginBottom: 6 },
  meta: { ...uiTypography.chip, marginBottom: uiSpace.sm },
  copy: { ...uiTypography.body, marginBottom: uiSpace.xs },
});
