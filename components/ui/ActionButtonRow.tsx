import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { uiBorder, uiSpace } from "@/constants/UiTokens";

type ActionButtonRowProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  separated?: boolean;
  separatorColor?: string;
};

export function ActionButtonRow({
  children,
  style,
  separated = false,
  separatorColor,
}: ActionButtonRowProps) {
  return (
    <View
      style={[
        styles.row,
        separated && {
          borderTopWidth: uiBorder.hairline,
          borderTopColor: separatorColor ?? "transparent",
          paddingTop: uiSpace.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: uiSpace.md,
    marginTop: uiSpace.lg,
  },
});
