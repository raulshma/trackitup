import { SymbolView } from "expo-symbols";
import type { ComponentProps, ReactNode } from "react";
import {
    StyleSheet,
    View,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from "react-native";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import {
    uiBorder,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";

import { SectionSurface } from "./SectionSurface";

type MessageSymbolName = ComponentProps<typeof SymbolView>["name"];

type SectionMessageProps = {
  palette: AppPalette;
  label: string;
  title: string;
  message: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  messageStyle?: StyleProp<TextStyle>;
  messageColor?: string;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  icon?: MessageSymbolName;
};

export function SectionMessage({
  palette,
  label,
  title,
  message,
  children,
  style,
  messageStyle,
  messageColor,
  elevation = 1,
  icon = { ios: "info.circle.fill", android: "info", web: "info" },
}: SectionMessageProps) {
  return (
    <SectionSurface
      palette={palette}
      label={label}
      title={title}
      style={style}
      elevation={elevation}
    >
      {children}
      <View style={styles.messageRow}>
        <View
          style={[styles.iconBadge, { backgroundColor: palette.accentSoft }]}
        >
          <SymbolView name={icon} size={18} tintColor={palette.tint} />
        </View>
        <Text
          style={[
            styles.message,
            { color: messageColor ?? palette.muted },
            messageStyle,
          ]}
        >
          {message}
        </Text>
      </View>
    </SectionSurface>
  );
}

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: uiSpace.md,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: uiRadius.pill,
    borderWidth: uiBorder.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    ...uiTypography.body,
    flex: 1,
    lineHeight: 21,
  },
});
