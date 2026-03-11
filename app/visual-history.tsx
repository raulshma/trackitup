import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Image,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    View,
} from "react-native";
import { Button, Chip } from "react-native-paper";

import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { ChipRow } from "@/components/ui/ChipRow";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import {
    PhotoLightbox,
    type LightboxItem,
} from "@/components/ui/PhotoLightbox";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
    uiBorder,
    uiRadius,
    uiShadow,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
    buildVisualRecapShareMessage,
    buildVisualRecapTitle,
} from "@/services/export/workspaceVisualRecapContent";
import { exportVisualRecapPdfAsync } from "@/services/export/workspaceVisualRecapExport";
import {
    loadVisualRecapCoverSelections,
    persistVisualRecapCoverSelections,
} from "@/services/insights/visualRecapPreferencePersistence";
import {
    applyVisualRecapCoverSelections,
    buildWorkspaceVisualHistory,
    getVisualRecapCoverSelectionKey,
    type VisualHistoryPhotoItem,
    type VisualRecapCoverSelections,
} from "@/services/insights/workspaceVisualHistory";

type VisualHistoryParams = {
  assetId?: string | string[];
  spaceId?: string | string[];
};

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMonth(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
}

function buildLightboxItems(photos: VisualHistoryPhotoItem[]): LightboxItem[] {
  return photos.map((photo) => ({
    id: photo.id,
    uri: photo.uri,
    title: photo.logTitle,
    subtitle: `${photo.spaceName} • ${formatDateTime(photo.capturedAt)}`,
    badge: photo.proofLabel,
  }));
}

export default function VisualHistoryScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const params = useLocalSearchParams<VisualHistoryParams>();
  const { workspace } = useWorkspace();
  const [recapCoverSelections, setRecapCoverSelections] =
    useState<VisualRecapCoverSelections>({});

  const assetId = pickParam(params.assetId);
  const spaceId = pickParam(params.spaceId);
  const asset = workspace.assets.find((item) => item.id === assetId);
  const space = workspace.spaces.find((item) => item.id === spaceId);
  const historyScope = useMemo(
    () => ({ assetId, spaceId }),
    [assetId, spaceId],
  );
  const baseHistory = useMemo(
    () => buildWorkspaceVisualHistory(workspace, historyScope),
    [historyScope, workspace],
  );
  const history = useMemo(
    () =>
      applyVisualRecapCoverSelections(
        baseHistory,
        historyScope,
        recapCoverSelections,
      ),
    [baseHistory, historyScope, recapCoverSelections],
  );
  const scopeLabel = asset ? asset.name : space ? space.name : "Workspace";
  const lightboxItems = useMemo<LightboxItem[]>(
    () => buildLightboxItems(history.photos),
    [history.photos],
  );
  const [lightboxState, setLightboxState] = useState<{
    items: LightboxItem[];
    initialIndex: number;
  } | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [busyRecapKey, setBusyRecapKey] = useState<string | null>(null);

  const title = asset
    ? `${asset.name} photo timeline`
    : space
      ? `${space.name} visual history`
      : "Workspace visual history";
  const subtitle = asset
    ? "Track progress for one asset, compare early vs latest photos, and jump back to the linked logs."
    : space
      ? "Review progress photos, proof-of-completion shots, and monthly recaps for this space."
      : "Browse progress photos across your workspace and open the logs that captured each moment.";
  const latestPhoto = history.photos[0];
  const logbookActionPath = asset
    ? (`/logbook?actionId=quick-log&spaceId=${asset.spaceId}` as never)
    : space
      ? (`/logbook?actionId=quick-log&spaceId=${space.id}` as never)
      : ("/logbook?actionId=quick-log" as never);
  const pageQuickActions = [
    {
      id: "visual-history-log",
      label: latestPhoto ? "Open latest log" : "Record proof",
      hint: latestPhoto
        ? `Jump back to ${latestPhoto.logTitle} and the photo context behind it.`
        : `Start the next proof capture for ${scopeLabel.toLowerCase()}.`,
      onPress: () =>
        router.push(
          latestPhoto
            ? (`/logbook?entryId=${latestPhoto.logId}` as never)
            : logbookActionPath,
        ),
      accentColor: palette.tint,
    },
    {
      id: "visual-history-record",
      label: "Add new proof",
      hint: `Capture another photo so ${scopeLabel.toLowerCase()} keeps a stronger visual trail.`,
      onPress: () => router.push(logbookActionPath),
      accentColor: palette.secondary,
    },
    {
      id: "visual-history-scope",
      label: asset || space ? "Open workspace gallery" : "Open inventory",
      hint:
        asset || space
          ? "Step back out to the wider workspace photo timeline."
          : `${workspace.assets.length} tracked asset${workspace.assets.length === 1 ? "" : "s"} connect into this gallery.`,
      onPress: () =>
        router.push(
          asset || space
            ? ("/visual-history" as never)
            : ("/inventory" as never),
        ),
    },
  ];

  useEffect(() => {
    let isCancelled = false;

    void loadVisualRecapCoverSelections().then((selections) => {
      if (!isCancelled) {
        setRecapCoverSelections(selections);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  function openLightbox(items: LightboxItem[], initialIndex: number) {
    setLightboxState({ items, initialIndex });
  }

  function handlePinRecapCover(monthKey: string, photoId: string) {
    const selectionKey = getVisualRecapCoverSelectionKey(
      historyScope,
      monthKey,
    );

    setRecapCoverSelections((currentSelections) => {
      const nextSelections = {
        ...currentSelections,
        [selectionKey]: photoId,
      };
      void persistVisualRecapCoverSelections(nextSelections);
      return nextSelections;
    });

    setExportMessage(`${formatMonth(monthKey)} cover photo updated.`);
  }

  async function handleExportRecap(monthKey: string, mode: "export" | "share") {
    const recap = history.monthlyRecaps.find(
      (item) => item.monthKey === monthKey,
    );
    if (!recap) return;

    setBusyRecapKey(monthKey);
    try {
      const uri = await exportVisualRecapPdfAsync(scopeLabel, recap);
      const title = buildVisualRecapTitle(scopeLabel, recap);

      if (mode === "share" && Platform.OS !== "web") {
        await Share.share({
          title,
          message: buildVisualRecapShareMessage(scopeLabel, recap),
          url: uri,
        });
        setExportMessage(`Shared ${title}.`);
        return;
      }

      setExportMessage(`${title} exported to ${uri}`);
    } catch (error) {
      setExportMessage(
        error instanceof Error
          ? error.message
          : "The recap could not be exported right now.",
      );
    } finally {
      setBusyRecapKey(null);
    }
  }

  return (
    <View style={[styles.screen, paletteStyles.screenBackground]}>
      <Stack.Screen options={{ title: "Visual history" }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <ScreenHero
          palette={palette}
          title={title}
          subtitle={subtitle}
          badges={[
            {
              label: `${history.photoCount} photo(s)`,
              backgroundColor: palette.card,
              textColor: palette.tint,
            },
            {
              label: `${history.proofCount} proof shot(s)`,
              backgroundColor: palette.accentSoft,
            },
            {
              label: `${history.monthlyRecaps.length} month recap(s)`,
              backgroundColor: palette.card,
              textColor: palette.tint,
            },
          ]}
        />

        <PageQuickActions
          palette={palette}
          title="Act on the visual trail"
          description="Jump into the linked log, capture the next proof photo, or change gallery scope without losing the context of the current history view."
          actions={pageQuickActions}
        />

        {exportMessage ? (
          <SectionMessage
            palette={palette}
            label="Recap export"
            title="Latest visual recap action"
            message={exportMessage}
            style={styles.messageCard}
          />
        ) : null}

        {history.photos.length === 0 ? (
          <SectionSurface
            palette={palette}
            label="Gallery"
            title="No photos yet"
          >
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Photos added to logs will appear here automatically. Use quick
              logs, routine runs, or reminder completions to build a visual
              timeline.
            </Text>
          </SectionSurface>
        ) : (
          <>
            {history.beforeAfter ? (
              <SectionSurface
                palette={palette}
                label="Comparison"
                title="Before and after"
              >
                <BeforeAfterSlider
                  palette={palette}
                  beforeUri={history.beforeAfter.before.uri}
                  afterUri={history.beforeAfter.after.uri}
                  beforeLabel="Before"
                  afterLabel="Latest"
                />
                <View style={styles.comparisonMetaRow}>
                  {[history.beforeAfter.before, history.beforeAfter.after].map(
                    (item, index) => (
                      <Pressable
                        key={item.id}
                        style={[
                          styles.comparisonCard,
                          paletteStyles.cardChipSurface,
                        ]}
                        onPress={() =>
                          openLightbox(
                            lightboxItems,
                            lightboxItems.findIndex(
                              (candidate) => candidate.id === item.id,
                            ),
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.comparisonLabel,
                            { color: item.spaceColor },
                          ]}
                        >
                          {index === 0 ? "Before" : "Latest"}
                        </Text>
                        <Text style={styles.photoTitle}>{item.logTitle}</Text>
                        <Text style={[styles.meta, paletteStyles.mutedText]}>
                          {formatDateTime(item.capturedAt)}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
              </SectionSurface>
            ) : null}

            {!assetId && history.assetGalleries.length > 0 ? (
              <SectionSurface
                palette={palette}
                label="Assets"
                title="Progress galleries"
              >
                {history.assetGalleries.map((gallery) => (
                  <View key={gallery.id} style={styles.galleryRow}>
                    <Image
                      source={{ uri: gallery.latestUri }}
                      style={styles.galleryThumb}
                    />
                    <View style={styles.galleryCopy}>
                      <Text style={styles.galleryTitle}>{gallery.label}</Text>
                      <Text style={[styles.meta, paletteStyles.mutedText]}>
                        {gallery.photoCount} photo(s) • {gallery.proofCount}{" "}
                        proof shot(s)
                      </Text>
                    </View>
                    <Button
                      mode="outlined"
                      onPress={() =>
                        router.push(
                          `/visual-history?assetId=${gallery.id}` as never,
                        )
                      }
                    >
                      Open
                    </Button>
                  </View>
                ))}
              </SectionSurface>
            ) : null}

            <SectionSurface
              palette={palette}
              label="Highlight reels"
              title="Monthly recaps"
            >
              {history.monthlyRecaps.map((recap) => {
                const isPinnedCover =
                  recapCoverSelections[
                    getVisualRecapCoverSelectionKey(
                      historyScope,
                      recap.monthKey,
                    )
                  ] === recap.coverPhotoId;

                return (
                  <View
                    key={recap.monthKey}
                    style={[
                      styles.recapCard,
                      {
                        backgroundColor: palette.surface1,
                        borderColor: palette.border,
                        shadowColor: palette.shadow,
                      },
                    ]}
                  >
                    <View style={styles.recapHeaderRow}>
                      <View style={styles.recapHeaderCopy}>
                        <Text style={styles.recapTitle}>
                          {formatMonth(recap.monthKey)}
                        </Text>
                        <Text
                          style={[styles.recapIntro, paletteStyles.mutedText]}
                        >
                          Featured moments captured this month. Tap the cover to
                          open the full reel.
                        </Text>
                      </View>
                      {isPinnedCover ? (
                        <Chip compact style={styles.infoChip}>
                          Favorite cover pinned
                        </Chip>
                      ) : null}
                    </View>
                    <ChipRow style={styles.recapChipRow}>
                      <Chip compact style={styles.infoChip}>
                        {recap.photoCount} photo(s)
                      </Chip>
                      <Chip compact style={styles.infoChip}>
                        {recap.proofCount} proof shot(s)
                      </Chip>
                    </ChipRow>
                    {recap.coverUri ? (
                      <Pressable
                        style={styles.recapCoverFrame}
                        onPress={() =>
                          openLightbox(buildLightboxItems(recap.items), 0)
                        }
                      >
                        <Image
                          source={{ uri: recap.coverUri }}
                          style={styles.recapCoverImage}
                        />
                        <View style={styles.recapCoverOverlay}>
                          <View style={styles.recapCoverTopRow}>
                            <Chip compact style={styles.recapOverlayChip}>
                              Cover photo
                            </Chip>
                            {recap.proofCount > 0 ? (
                              <Chip compact style={styles.recapOverlayChip}>
                                {recap.proofCount} proof shot(s)
                              </Chip>
                            ) : null}
                          </View>
                          <View style={styles.recapCoverBottomRow}>
                            <View style={styles.recapCoverCopy}>
                              <Text style={styles.recapCoverTitle}>
                                {recap.items[0]?.logTitle ??
                                  "Monthly highlight"}
                              </Text>
                              <Text style={styles.recapCoverHint}>
                                Tap to open reel • {recap.items.length} captured
                                moment(s)
                              </Text>
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    ) : null}
                    <View style={styles.highlightStrip}>
                      {recap.items.map((item, index) => (
                        <View
                          key={item.id}
                          style={[
                            styles.highlightCard,
                            {
                              backgroundColor:
                                recap.coverPhotoId === item.id
                                  ? palette.primaryContainer
                                  : palette.card,
                              borderColor:
                                recap.coverPhotoId === item.id
                                  ? palette.tint
                                  : palette.border,
                            },
                          ]}
                        >
                          <Pressable
                            onPress={() =>
                              openLightbox(
                                buildLightboxItems(recap.items),
                                index,
                              )
                            }
                          >
                            <Image
                              source={{ uri: item.uri }}
                              style={styles.highlightImage}
                            />
                          </Pressable>
                          <View style={styles.highlightCopy}>
                            <Text
                              numberOfLines={1}
                              style={styles.highlightTitle}
                            >
                              {item.logTitle}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.highlightMeta,
                                paletteStyles.mutedText,
                              ]}
                            >
                              {formatDateTime(item.capturedAt)}
                            </Text>
                          </View>
                          <Button
                            compact
                            mode={
                              recap.coverPhotoId === item.id
                                ? "contained-tonal"
                                : "text"
                            }
                            contentStyle={styles.highlightButtonContent}
                            onPress={() =>
                              handlePinRecapCover(recap.monthKey, item.id)
                            }
                          >
                            {recap.coverPhotoId === item.id
                              ? "Pinned cover"
                              : "Pin cover"}
                          </Button>
                        </View>
                      ))}
                    </View>
                    <ActionButtonRow style={styles.recapActionRow}>
                      <Button
                        mode="contained"
                        onPress={() =>
                          void handleExportRecap(recap.monthKey, "share")
                        }
                        loading={busyRecapKey === recap.monthKey}
                        disabled={busyRecapKey !== null}
                      >
                        {Platform.OS === "web" ? "Export recap" : "Share recap"}
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() =>
                          void handleExportRecap(recap.monthKey, "export")
                        }
                        disabled={busyRecapKey !== null}
                      >
                        Export PDF
                      </Button>
                    </ActionButtonRow>
                  </View>
                );
              })}
            </SectionSurface>

            <SectionSurface
              palette={palette}
              label="Timeline"
              title="Progress gallery"
            >
              {history.photos.map((photo) => (
                <View
                  key={photo.id}
                  style={[styles.photoCard, paletteStyles.cardChipSurface]}
                >
                  <Pressable
                    onPress={() =>
                      openLightbox(
                        lightboxItems,
                        lightboxItems.findIndex((item) => item.id === photo.id),
                      )
                    }
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photoImage}
                    />
                  </Pressable>
                  <View style={styles.photoCopy}>
                    <ChipRow style={styles.photoChipRow}>
                      <Chip compact style={styles.infoChip}>
                        {photo.spaceName}
                      </Chip>
                      <Chip compact style={styles.infoChip}>
                        {formatDateTime(photo.capturedAt)}
                      </Chip>
                      {photo.proofLabel ? (
                        <Chip compact style={styles.infoChip}>
                          {photo.proofLabel}
                        </Chip>
                      ) : null}
                    </ChipRow>
                    <Text style={styles.photoTitle}>{photo.logTitle}</Text>
                    <Text style={[styles.copy, paletteStyles.mutedText]}>
                      {photo.logNote}
                    </Text>
                    {photo.assetNames.length > 0 ? (
                      <Text style={[styles.meta, paletteStyles.mutedText]}>
                        Assets: {photo.assetNames.join(" • ")}
                      </Text>
                    ) : null}
                    <ActionButtonRow>
                      <Button
                        mode="outlined"
                        onPress={() =>
                          router.push(
                            `/logbook?entryId=${photo.logId}` as never,
                          )
                        }
                      >
                        Open log
                      </Button>
                      {!assetId && photo.assetIds.length === 1 ? (
                        <Button
                          mode="text"
                          onPress={() =>
                            router.push(
                              `/visual-history?assetId=${photo.assetIds[0]}` as never,
                            )
                          }
                        >
                          Asset gallery
                        </Button>
                      ) : null}
                    </ActionButtonRow>
                  </View>
                </View>
              ))}
            </SectionSurface>
          </>
        )}
      </ScrollView>

      <PhotoLightbox
        visible={Boolean(lightboxState)}
        palette={palette}
        items={lightboxState?.items ?? []}
        initialIndex={lightboxState?.initialIndex ?? 0}
        onRequestClose={() => setLightboxState(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: uiSpace.screen, paddingBottom: uiSpace.screenBottom },
  messageCard: { marginBottom: uiSpace.xl },
  copy: uiTypography.body,
  meta: uiTypography.bodySmall,
  comparisonMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
    marginTop: uiSpace.lg,
  },
  comparisonCard: {
    flex: 1,
    minWidth: 150,
    gap: uiSpace.xs,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
  },
  comparisonLabel: { ...uiTypography.label, marginBottom: 4 },
  galleryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiSpace.md,
    marginBottom: uiSpace.lg,
  },
  galleryThumb: {
    width: 64,
    height: 64,
    borderRadius: uiRadius.lg,
    backgroundColor: "#00000014",
  },
  galleryCopy: { flex: 1 },
  galleryTitle: uiTypography.titleMd,
  recapCard: {
    marginBottom: uiSpace.xl,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.hero,
    padding: uiSpace.surface,
    ...uiShadow.raisedCard,
  },
  recapHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: uiSpace.md,
  },
  recapHeaderCopy: { flex: 1, gap: uiSpace.xs },
  recapTitle: { ...uiTypography.titleMd, marginBottom: uiSpace.sm },
  recapIntro: uiTypography.bodySmall,
  recapChipRow: { marginBottom: uiSpace.md },
  recapCoverFrame: {
    borderRadius: uiRadius.xl,
    overflow: "hidden",
    marginBottom: uiSpace.md,
  },
  recapCoverImage: {
    width: "100%",
    height: 188,
    backgroundColor: "#00000014",
  },
  recapCoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: uiSpace.md,
    backgroundColor: "rgba(15, 23, 42, 0.2)",
  },
  recapCoverTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.sm,
    justifyContent: "space-between",
  },
  recapOverlayChip: {
    backgroundColor: "rgba(15, 23, 42, 0.66)",
    borderRadius: uiRadius.pill,
  },
  recapCoverBottomRow: {
    marginTop: uiSpace.hero,
  },
  recapCoverCopy: {
    gap: uiSpace.xxs,
    paddingTop: uiSpace.xl,
  },
  recapCoverTitle: {
    ...uiTypography.titleLg,
    color: "#ffffff",
  },
  recapCoverHint: {
    ...uiTypography.bodySmall,
    color: "rgba(255,255,255,0.88)",
  },
  recapActionRow: {
    marginTop: uiSpace.md,
    paddingTop: uiSpace.md,
    borderTopWidth: uiBorder.hairline,
    borderTopColor: "rgba(148, 163, 184, 0.3)",
  },
  infoChip: { borderRadius: uiRadius.md },
  highlightStrip: { flexDirection: "row", flexWrap: "wrap", gap: uiSpace.sm },
  highlightCard: {
    width: 112,
    gap: uiSpace.xs,
    padding: uiSpace.sm,
    borderRadius: uiRadius.lg,
    borderWidth: uiBorder.standard,
  },
  highlightCopy: { gap: 2 },
  highlightTitle: uiTypography.label,
  highlightMeta: uiTypography.bodySmall,
  highlightButtonContent: {
    minHeight: 30,
  },
  highlightImage: {
    width: 96,
    height: 96,
    borderRadius: uiRadius.lg,
    backgroundColor: "#00000014",
  },
  photoCard: {
    borderRadius: uiRadius.xl,
    marginBottom: uiSpace.xl,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: 220,
    backgroundColor: "#00000014",
  },
  photoCopy: { padding: uiSpace.surface },
  photoChipRow: { marginBottom: uiSpace.sm },
  photoTitle: { ...uiTypography.titleSection, marginBottom: uiSpace.xs },
});
