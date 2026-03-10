import { StyleSheet } from "react-native";

export const dynamicFormStyles = StyleSheet.create({
  sectionBlock: { marginTop: 4, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  sectionCopy: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  fieldCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  fieldLabel: { flex: 1, fontSize: 14, fontWeight: "700" },
  required: { fontSize: 12, fontWeight: "700" },
  fieldDescription: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: { fontSize: 14, fontWeight: "700", flex: 1, marginRight: 12 },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { marginRight: 8, marginBottom: 8 },
  checkboxItem: { paddingHorizontal: 0 },
  toolButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  inlineToolRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  inlineToolButton: {
    marginRight: 6,
  },
  toolButton: {
    marginRight: 6,
    marginBottom: 6,
  },
  capturePanel: {
    marginTop: 12,
  },
  cameraPreview: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 10,
  },
  attachmentList: {
    marginTop: 12,
    gap: 10,
  },
  attachmentCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  attachmentPreview: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
  },
  attachmentTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  attachmentMeta: { fontSize: 12, lineHeight: 18 },
  emptyState: { fontSize: 13, lineHeight: 18, marginTop: 12 },
});
