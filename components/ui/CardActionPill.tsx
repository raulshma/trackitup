import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme, type MD3Theme } from "react-native-paper";

import { Text } from "@/components/Themed";
import {
    uiBorder,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { MotionPressable } from "./Motion";

type CardActionPillProps = {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function CardActionPill({
  label,
  onPress,
  disabled = false,
  accentColor,
  style,
}: CardActionPillProps) {
  const theme = useTheme<MD3Theme>();
  const tint = accentColor ?? theme.colors.primary;

  return (
    <MotionPressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => void onPress()}
      style={[
        styles.pill,
        {
          backgroundColor: disabled
            ? theme.colors.elevation.level1
            : `${tint}14`,
          borderColor: disabled ? theme.colors.outlineVariant : `${tint}26`,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: disabled ? theme.colors.onSurfaceVariant : tint },
        ]}
      >
        {label}
      </Text>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 38,
    minWidth: 74,
    borderRadius: uiRadius.pill,
    borderWidth: uiBorder.hairline,
    paddingHorizontal: uiSpace.lg,
    paddingVertical: uiSpace.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...uiTypography.label,
    textTransform: "none",
  },
});
