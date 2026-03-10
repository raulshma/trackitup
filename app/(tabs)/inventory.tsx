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

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Inventory & lifecycle</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Asset profiles, lifecycle status, warranty dates, barcode / QR
          metadata, and total cost of ownership.
        </Text>
      </View>

      <View
        style={[
          styles.summaryCard,
          { backgroundColor: palette.card, borderColor: palette.border },
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

      {assetCards.map((asset) => (
        <View
          key={asset.id}
          style={[
            styles.card,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              borderLeftColor: palette.tint,
            },
          ]}
        >
          <Text style={styles.cardTitle}>{asset.name}</Text>
          <Text style={[styles.meta, { color: palette.tint }]}>
            {asset.spaceName} • {asset.category} • {asset.status.toUpperCase()}
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
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  header: { marginBottom: 18 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  summaryTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  summaryValue: { fontSize: 26, fontWeight: "800", marginBottom: 6 },
  summaryCopy: { fontSize: 14, lineHeight: 20 },
  scanButton: { marginTop: 14 },
  card: {
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", marginBottom: 6 },
  meta: { fontSize: 12, fontWeight: "700", marginBottom: 8 },
  copy: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
