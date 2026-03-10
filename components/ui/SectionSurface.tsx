import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Surface } from "react-native-paper";

import { Text } from "@/components/Themed";
import Colors from "@/constants/Colors";

type AppPalette = (typeof Colors)[keyof typeof Colors];

type SectionSurfaceProps = {
  palette: AppPalette;
  label?: string;
  title?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
};

export function SectionSurface({
  palette,
  label,
  title,
  children,
  style,
  elevation = 1,
}: SectionSurfaceProps) {
  return (
    <Surface
      style={[
        styles.card,
        { backgroundColor: palette.card, borderColor: palette.border },
        style,
      ]}
      elevation={elevation}
    >
      {label ? <Text style={[styles.label, { color: palette.tint }]}>{label}</Text> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
});