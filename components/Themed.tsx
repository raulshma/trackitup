/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */
import { Text as DefaultText, View as DefaultView } from "react-native";
import { type MD3Theme, useTheme } from "react-native-paper";

import { useColorScheme } from "./useColorScheme";

import Colors from "@/constants/Colors";

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
  oledColor?: string;
  monotoneColor?: string;
};

export type TextProps = ThemeProps & DefaultText["props"];
export type ViewProps = ThemeProps & DefaultView["props"];

export function useThemeColor(
  props: { light?: string; dark?: string; oled?: string; monotone?: string },
  fallbackColor: string,
) {
  const theme = useColorScheme();
  const colorFromProps =
    theme === "light"
      ? props.light
      : theme === "oled"
        ? (props.oled ?? props.dark)
        : theme === "monotone-light"
          ? (props.monotone ?? props.light ?? props.dark)
          : theme === "monotone-dark"
            ? (props.monotone ?? props.dark)
            : props.dark;

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return fallbackColor ?? Colors[theme].text;
  }
}

export function Text(props: TextProps) {
  const {
    style,
    lightColor,
    darkColor,
    oledColor,
    monotoneColor,
    ...otherProps
  } = props;
  const theme = useTheme<MD3Theme>();
  const color = useThemeColor(
    {
      light: lightColor,
      dark: darkColor,
      oled: oledColor,
      monotone: monotoneColor,
    },
    theme.colors.onSurface,
  );

  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const {
    style,
    lightColor,
    darkColor,
    oledColor,
    monotoneColor,
    ...otherProps
  } = props;
  const theme = useTheme<MD3Theme>();
  const backgroundColor = useThemeColor(
    {
      light: lightColor,
      dark: darkColor,
      oled: oledColor,
      monotone: monotoneColor,
    },
    theme.colors.background,
  );

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
