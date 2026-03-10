import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { uiSpace } from "@/constants/UiTokens";

type ActionButtonRowProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ActionButtonRow({ children, style }: ActionButtonRowProps) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
    marginTop: uiSpace.lg,
  },
});
