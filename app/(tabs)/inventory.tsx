import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Button } from "react-native-paper";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
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
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: palette.hero,
            borderColor: palette.heroBorder,
            shadowColor: palette.shadow,
          },
        ]}
      >
        <View style={styles.headerBadgeRow}>
          <View
            style={[
              styles.headerBadge,
              {
                backgroundColor: palette.card,
                borderColor: palette.heroBorder,
              },
            ]}
          >
            <Text style={[styles.headerBadgeLabel, { color: palette.tint }]}>
              Inventory
            </Text>
          </View>
          <View
            style={[
              styles.headerBadge,
              {
                backgroundColor: palette.accentSoft,
                borderColor: palette.heroBorder,
              },
            ]}
          >
            <Text style={styles.headerBadgeLabel}>
              {formatCurrency(totalOwnership)} total
            </Text>
          </View>
        </View>
        <Text style={styles.title}>Inventory & lifecycle</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Keep hardware, supplies, and maintenance context in one place with
          clearer ownership costs, scan access, and lifecycle visibility.
        </Text>
        <View style={styles.highlightRow}>
          {inventoryHighlights.map((item) => (
            <View
              key={item}
              style={[
                styles.highlightPill,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.heroBorder,
                },
              ]}
            >
              <Text style={styles.highlightLabel}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: palette.card,
            borderColor: palette.border,
            shadowColor: palette.shadow,
          },
        ]}
      >
        <Text style={styles.summaryTitle}>Tracked ownership cost</Text>
        <Text style={styles.summaryValue}>
          {formatCurrency(totalOwnership)}
        </Text>
        <Text style={[styles.summaryCopy, { color: palette.muted }]}>
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
      </View>

      {assetCards.length === 0 ? (
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              borderLeftColor: palette.border,
              shadowColor: palette.shadow,
            },
          ]}
        >
          <Text style={styles.cardTitle}>No tracked assets yet</Text>
          <Text style={[styles.copy, { color: palette.muted }]}>
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
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                borderLeftColor: palette.tint,
                shadowColor: palette.shadow,
              },
            ]}
          >
            <Text style={styles.cardTitle}>{asset.name}</Text>
            <Text style={[styles.meta, { color: palette.tint }]}>
              {asset.spaceName} • {asset.category} •{" "}
              {asset.status.toUpperCase()}
            </Text>
            <Text style={[styles.copy, { color: palette.muted }]}>
              {asset.note}
            </Text>
            <Text style={[styles.copy, { color: palette.muted }]}>
              Purchase: {asset.purchaseDate ?? "n/a"} •{" "}
              {formatCurrency(asset.purchasePrice ?? 0)}
            </Text>
            <Text style={[styles.copy, { color: palette.muted }]}>
              Warranty: {asset.warrantyExpiresAt ?? "n/a"}
              {asset.warrantyNote ? ` • ${asset.warrantyNote}` : ""}
            </Text>
            <Text style={[styles.copy, { color: palette.muted }]}>
              Linked logs: {asset.relatedLogCount} • Ownership cost:{" "}
              {formatCurrency(asset.expenseTotal)}
            </Text>
            {asset.barcodeValue || asset.qrCodeValue ? (
              <Text style={[styles.copy, { color: palette.muted }]}>
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
  content: { padding: 20, paddingBottom: 120, gap: 16 },
  header: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 4,
  },
  headerBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  headerBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerBadgeLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  title: { fontSize: 30, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  highlightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  highlightPill: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  highlightLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  summaryTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  summaryValue: { fontSize: 26, fontWeight: "800", marginBottom: 6 },
  summaryCopy: { fontSize: 14, lineHeight: 20 },
  scanButton: { marginTop: 14 },
  card: {
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", marginBottom: 6 },
  meta: { fontSize: 12, fontWeight: "700", marginBottom: 8 },
  copy: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
