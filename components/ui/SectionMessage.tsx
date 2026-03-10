import type { ReactNode } from "react";
import {
    StyleSheet,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from "react-native";

import { Text } from "@/components/Themed";
import type { AppPalette } from "@/constants/AppTheme";
import { uiTypography } from "@/constants/UiTokens";

import { SectionSurface } from "./SectionSurface";

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
      <Text
        style={[
          styles.message,
          { color: messageColor ?? palette.muted },
          messageStyle,
        ]}
      >
        {message}
      </Text>
    </SectionSurface>
  );
}

const styles = StyleSheet.create({
  message: uiTypography.body,
});
