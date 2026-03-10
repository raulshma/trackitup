import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { uiSpace } from "@/constants/UiTokens";

type ChipRowProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ChipRow({ children, style }: ChipRowProps) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.sm,
  },
});
