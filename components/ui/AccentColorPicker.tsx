import { useEffect, useMemo, useState } from "react";
import {
    PanResponder,
    Pressable,
    StyleSheet,
    View,
    type LayoutChangeEvent,
} from "react-native";
import { Chip, Surface, TextInput } from "react-native-paper";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { Text } from "@/components/Themed";
import { withAlpha, type AppPalette } from "@/constants/Colors";
import {
    getShadowStyle,
    uiBorder,
    uiRadius,
    uiShadow,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import {
    THEME_ACCENT_PRESETS,
    getThemeAccentPresetId,
    isValidHexColor,
    normalizeThemeAccentColor,
} from "@/services/theme/themePreferences";

type AccentColorPickerProps = {
  palette: AppPalette;
  value: string;
  onChange: (color: string) => void;
  title?: string;
  description?: string;
};

type Hsv = {
  hue: number;
  saturation: number;
  value: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(color: string) {
  const normalized = normalizeThemeAccentColor(color).slice(1);
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((channel) =>
      clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"),
    )
    .join("")}`;
}

function hsvToHex(hue: number, saturation: number, value: number) {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const chroma = value * saturation;
  const segment = normalizedHue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = value - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = secondary;
  } else if (segment < 2) {
    red = secondary;
    green = chroma;
  } else if (segment < 3) {
    green = chroma;
    blue = secondary;
  } else if (segment < 4) {
    green = secondary;
    blue = chroma;
  } else if (segment < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  return rgbToHex(
    (red + match) * 255,
    (green + match) * 255,
    (blue + match) * 255,
  );
}

function hexToHsv(color: string): Hsv {
  const { red, green, blue } = hexToRgb(color);
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    switch (max) {
      case r:
        hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        hue = ((b - r) / delta + 2) * 60;
        break;
      default:
        hue = ((r - g) / delta + 4) * 60;
        break;
    }
  }

  return {
    hue,
    saturation: max === 0 ? 0 : delta / max,
    value: max,
  };
}

export function AccentColorPicker({
  palette,
  value,
  onChange,
  title = "Accent presets",
  description = "Pick a preset, or fine-tune your own accent with the custom color picker.",
}: AccentColorPickerProps) {
  const [panelLayout, setPanelLayout] = useState({ width: 0, height: 0 });
  const [hueLayout, setHueLayout] = useState({ width: 0, height: 0 });
  const [hexInput, setHexInput] = useState(value);
  const hsv = useMemo(() => hexToHsv(value), [value]);
  const activePresetId = getThemeAccentPresetId(value);
  const hueColor = useMemo(() => hsvToHex(hsv.hue, 1, 1), [hsv.hue]);
  const surfaceShadow = useMemo(
    () => getShadowStyle(palette.shadow, uiShadow.raisedCard),
    [palette.shadow],
  );

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  function commitHexInput() {
    if (!isValidHexColor(hexInput)) {
      setHexInput(value);
      return;
    }

    onChange(normalizeThemeAccentColor(hexInput));
  }

  function handlePanelLayout(event: LayoutChangeEvent) {
    setPanelLayout(event.nativeEvent.layout);
  }

  function handleHueLayout(event: LayoutChangeEvent) {
    setHueLayout(event.nativeEvent.layout);
  }

  function updateSaturationValue(nextX: number, nextY: number) {
    if (panelLayout.width <= 0 || panelLayout.height <= 0) return;

    const saturation = clamp(nextX / panelLayout.width, 0, 1);
    const brightness = 1 - clamp(nextY / panelLayout.height, 0, 1);
    onChange(hsvToHex(hsv.hue, saturation, brightness));
  }

  function updateHue(nextX: number) {
    if (hueLayout.width <= 0) return;

    const hue = clamp(nextX / hueLayout.width, 0, 1) * 360;
    onChange(hsvToHex(hue, hsv.saturation, hsv.value));
  }

  const panelResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) =>
          updateSaturationValue(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          ),
        onPanResponderMove: (event) =>
          updateSaturationValue(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          ),
      }),
    [hsv.hue, panelLayout.height, panelLayout.width],
  );

  const hueResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => updateHue(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updateHue(event.nativeEvent.locationX),
      }),
    [hsv.saturation, hsv.value, hueLayout.width],
  );

  const panelCursorLeft = panelLayout.width * hsv.saturation;
  const panelCursorTop = panelLayout.height * (1 - hsv.value);
  const hueCursorLeft = hueLayout.width * (hsv.hue / 360);

  return (
    <View style={styles.stack}>
      <View>
        <Text style={styles.heading}>{title}</Text>
        <Text style={[styles.copy, { color: palette.muted }]}>
          {description}
        </Text>
      </View>

      <View style={styles.presetGrid}>
        {THEME_ACCENT_PRESETS.map((preset) => {
          const isSelected = preset.id === activePresetId;

          return (
            <Pressable
              key={preset.id}
              accessibilityRole="button"
              accessibilityLabel={`Use ${preset.label} accent`}
              onPress={() => onChange(preset.color)}
              style={[
                styles.presetCard,
                {
                  backgroundColor: palette.card,
                  borderColor: isSelected ? palette.tint : palette.border,
                },
              ]}
            >
              <View
                style={[styles.presetSwatch, { backgroundColor: preset.color }]}
              />
              <Text style={styles.presetLabel}>{preset.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Surface
        style={[
          styles.customSurface,
          {
            backgroundColor: palette.surface1,
            borderColor: palette.borderSoft,
          },
          surfaceShadow,
        ]}
        elevation={1}
      >
        <View style={styles.customHeader}>
          <View>
            <Text style={styles.customTitle}>Custom accent</Text>
            <Text style={[styles.copy, { color: palette.muted }]}>
              Drag inside the picker to fine-tune saturation and brightness,
              then slide the hue bar to chase the perfect vibe.
            </Text>
          </View>
          <Chip compact style={styles.hexChip}>
            {value.toUpperCase()}
          </Chip>
        </View>

        <View
          {...panelResponder.panHandlers}
          onLayout={handlePanelLayout}
          style={styles.panelFrame}
        >
          <Svg
            width="100%"
            height="100%"
            style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
          >
            <Defs>
              <LinearGradient
                id="accent-saturation"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <Stop offset="0%" stopColor="#ffffff" />
                <Stop offset="100%" stopColor={hueColor} />
              </LinearGradient>
              <LinearGradient
                id="accent-value"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <Stop offset="0%" stopColor="rgba(0,0,0,0)" />
                <Stop offset="100%" stopColor="#000000" />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#accent-saturation)"
              rx={uiRadius.lg}
              ry={uiRadius.lg}
            />
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#accent-value)"
              rx={uiRadius.lg}
              ry={uiRadius.lg}
            />
          </Svg>
          <View
            style={[
              styles.panelCursor,
              {
                left: clamp(
                  panelCursorLeft,
                  0,
                  Math.max(panelLayout.width - 20, 0),
                ),
                top: clamp(
                  panelCursorTop,
                  0,
                  Math.max(panelLayout.height - 20, 0),
                ),
                backgroundColor: value,
                borderColor: palette.inverseSurface,
                pointerEvents: "none",
              },
            ]}
          />
        </View>

        <View
          {...hueResponder.panHandlers}
          onLayout={handleHueLayout}
          style={styles.hueFrame}
        >
          <Svg
            width="100%"
            height="100%"
            style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
          >
            <Defs>
              <LinearGradient id="accent-hue" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#ff0000" />
                <Stop offset="16.67%" stopColor="#ffff00" />
                <Stop offset="33.34%" stopColor="#00ff00" />
                <Stop offset="50%" stopColor="#00ffff" />
                <Stop offset="66.67%" stopColor="#0000ff" />
                <Stop offset="83.34%" stopColor="#ff00ff" />
                <Stop offset="100%" stopColor="#ff0000" />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#accent-hue)"
              rx={uiRadius.pill}
              ry={uiRadius.pill}
            />
          </Svg>
          <View
            style={[
              styles.hueCursor,
              {
                left: clamp(
                  hueCursorLeft,
                  0,
                  Math.max(hueLayout.width - 20, 0),
                ),
                borderColor: palette.inverseSurface,
                backgroundColor: withAlpha(palette.inverseOnSurface, 0.75),
                pointerEvents: "none",
              },
            ]}
          />
        </View>

        <TextInput
          label="Custom hex color"
          value={hexInput}
          onChangeText={setHexInput}
          onBlur={commitHexInput}
          onSubmitEditing={commitHexInput}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          placeholder="#RRGGBB"
          mode="outlined"
        />
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: uiSpace.md,
    marginTop: uiSpace.md,
  },
  heading: uiTypography.titleMd,
  copy: uiTypography.bodySmall,
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.sm,
  },
  presetCard: {
    minWidth: 112,
    flexGrow: 1,
    flexBasis: "31%",
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.lg,
    paddingHorizontal: uiSpace.md,
    paddingVertical: uiSpace.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: uiSpace.sm,
  },
  presetSwatch: {
    width: 18,
    height: 18,
    borderRadius: uiRadius.pill,
  },
  presetLabel: uiTypography.bodySmall,
  customSurface: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    gap: uiSpace.md,
  },
  customHeader: {
    gap: uiSpace.sm,
  },
  customTitle: uiTypography.titleSm,
  hexChip: {
    alignSelf: "flex-start",
    borderRadius: uiRadius.pill,
  },
  panelFrame: {
    height: 184,
    borderRadius: uiRadius.lg,
    overflow: "hidden",
  },
  panelCursor: {
    position: "absolute",
    width: 20,
    height: 20,
    marginLeft: -10,
    marginTop: -10,
    borderRadius: uiRadius.pill,
    borderWidth: 2,
  },
  hueFrame: {
    height: 20,
    borderRadius: uiRadius.pill,
    overflow: "hidden",
  },
  hueCursor: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 20,
    marginLeft: -10,
    borderRadius: uiRadius.pill,
    borderWidth: 2,
  },
});
