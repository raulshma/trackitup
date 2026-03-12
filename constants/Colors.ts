import {
    DEFAULT_THEME_ACCENT_COLOR,
    normalizeThemeAccentColor,
} from "@/services/theme/themePreferences";

export type AppColorScheme = "light" | "dark" | "oled";
export type AppPalette = {
  text: string;
  background: string;
  tint: string;
  onTint: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  tabIconDefault: string;
  tabIconSelected: string;
  card: string;
  cardAlt: string;
  muted: string;
  border: string;
  borderSoft: string;
  hero: string;
  heroBorder: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  dangerContainer: string;
  onDangerContainer: string;
  surface1: string;
  surface2: string;
  surface3: string;
  surface4: string;
  surface5: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  shadow: string;
};

const chartSeriesPaletteKeys: Array<keyof AppPalette> = [
  "tint",
  "secondary",
  "tertiary",
  "success",
  "warning",
];

const basePalettes: Record<AppColorScheme, AppPalette> = {
  light: {
    text: "#0f172a",
    background: "#f8fafc",
    tint: DEFAULT_THEME_ACCENT_COLOR,
    onTint: "#ffffff",
    primaryContainer: "#d3e3fd",
    onPrimaryContainer: "#041e49",
    secondary: "#ec4899",
    onSecondary: "#ffffff",
    secondaryContainer: "#fce7f3",
    onSecondaryContainer: "#831843",
    tertiary: "#0ea5e9",
    onTertiary: "#ffffff",
    tertiaryContainer: "#e0f2fe",
    onTertiaryContainer: "#0c4a6e",
    tabIconDefault: "#64748b",
    tabIconSelected: DEFAULT_THEME_ACCENT_COLOR,
    card: "#ffffff",
    cardAlt: "#f1f5f9",
    muted: "#64748b",
    border: "#e2e8f0",
    borderSoft: "#f1f5f9",
    hero: "#e8f0fe",
    heroBorder: "#c2e7ff",
    accentSoft: "#edf4ff",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    dangerContainer: "#fee2e2",
    onDangerContainer: "#7f1d1d",
    surface1: "#f4f7fb",
    surface2: "#f1f4fa",
    surface3: "#ebeff7",
    surface4: "#e6ebf5",
    surface5: "#e0e6f2",
    inverseSurface: "#0f172a",
    inverseOnSurface: "#f8fafc",
    inversePrimary: "#a5b4fc",
    shadow: "rgba(15, 23, 42, 0.08)",
  },
  dark: {
    text: "#e3e2e6",
    background: "#111318",
    tint: "#a8c7fa",
    onTint: "#062e6f",
    primaryContainer: "#284777",
    onPrimaryContainer: "#d7e3ff",
    secondary: "#bec9d9",
    onSecondary: "#293241",
    secondaryContainer: "#3f4856",
    onSecondaryContainer: "#dae5f5",
    tertiary: "#efb8ff",
    onTertiary: "#492532",
    tertiaryContainer: "#633b48",
    onTertiaryContainer: "#ffd8e4",
    tabIconDefault: "#9aa0a6",
    tabIconSelected: "#a8c7fa",
    card: "#171b22",
    cardAlt: "#1e2430",
    muted: "#c4c7cf",
    border: "#43474e",
    borderSoft: "#5b6068",
    hero: "#1c2c4e",
    heroBorder: "#38588c",
    accentSoft: "#263246",
    success: "#81c995",
    warning: "#f9ab00",
    danger: "#f2b8b5",
    dangerContainer: "#8c1d18",
    onDangerContainer: "#f9dedc",
    surface1: "#1b1f27",
    surface2: "#1f2530",
    surface3: "#242a36",
    surface4: "#272f3d",
    surface5: "#2b3343",
    inverseSurface: "#e3e2e6",
    inverseOnSurface: "#2e3135",
    inversePrimary: "#0b57d0",
    shadow: "rgba(0, 0, 0, 0.4)",
  },
  oled: {
    text: "#f8f9fb",
    background: "#000000",
    tint: "#a8c7fa",
    onTint: "#062e6f",
    primaryContainer: "#102b52",
    onPrimaryContainer: "#d7e3ff",
    secondary: "#d0d4dc",
    onSecondary: "#11141a",
    secondaryContainer: "#1b212b",
    onSecondaryContainer: "#e8ebf2",
    tertiary: "#f2dcf6",
    onTertiary: "#3b2232",
    tertiaryContainer: "#523346",
    onTertiaryContainer: "#ffd8e4",
    tabIconDefault: "#9aa0a6",
    tabIconSelected: "#a8c7fa",
    card: "#040507",
    cardAlt: "#090c11",
    muted: "#cfd3db",
    border: "#191e26",
    borderSoft: "#252c36",
    hero: "#030814",
    heroBorder: "#1b2d4c",
    accentSoft: "#0d1118",
    success: "#81c995",
    warning: "#f9ab00",
    danger: "#f2b8b5",
    dangerContainer: "#8c1d18",
    onDangerContainer: "#f9dedc",
    surface1: "#030406",
    surface2: "#07090d",
    surface3: "#0b0f14",
    surface4: "#10151c",
    surface5: "#151b24",
    inverseSurface: "#e3e2e6",
    inverseOnSurface: "#111318",
    inversePrimary: "#0b57d0",
    shadow: "rgba(0, 0, 0, 0.9)",
  },
};

type Rgb = { red: number; green: number; blue: number };
type Hsl = { hue: number; saturation: number; lightness: number };

let activeThemeAccentColor: string = DEFAULT_THEME_ACCENT_COLOR;
let resolvedPalettes = buildResolvedPalettes(activeThemeAccentColor);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(color: string): Rgb {
  const normalized = normalizeThemeAccentColor(color).slice(1);
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#")) {
    const { red, green, blue } = hexToRgb(color);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  const rgbMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const [red, green, blue] = rgbMatch[1]
      .split(",")
      .map((part) => part.trim())
      .slice(0, 3);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  return color;
}

function rgbToHex({ red, green, blue }: Rgb): string {
  return `#${[red, green, blue]
    .map((channel) =>
      clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"),
    )
    .join("")}`;
}

function rgbToHsl({ red, green, blue }: Rgb): Hsl {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness };
  }

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  switch (max) {
    case r:
      hue = (g - b) / delta + (g < b ? 6 : 0);
      break;
    case g:
      hue = (b - r) / delta + 2;
      break;
    default:
      hue = (r - g) / delta + 4;
      break;
  }

  return {
    hue: hue * 60,
    saturation,
    lightness,
  };
}

function hslToRgb({ hue, saturation, lightness }: Hsl): Rgb {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = normalizedHue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = lightness - chroma / 2;

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

  return {
    red: (red + match) * 255,
    green: (green + match) * 255,
    blue: (blue + match) * 255,
  };
}

function mixColors(from: string, to: string, amount: number): string {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const ratio = clamp(amount, 0, 1);

  return rgbToHex({
    red: start.red + (end.red - start.red) * ratio,
    green: start.green + (end.green - start.green) * ratio,
    blue: start.blue + (end.blue - start.blue) * ratio,
  });
}

function getPerceivedLuminance(color: string): number {
  const { red, green, blue } = hexToRgb(color);
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
}

export function getReadableTextColor(
  color: string,
  light = "#ffffff",
  dark = "#08111f",
) {
  return getPerceivedLuminance(color) > 0.58 ? dark : light;
}

export function getChartSeriesColor(
  palette: AppPalette,
  index: number,
): string {
  return palette[chartSeriesPaletteKeys[index] ?? "tint"];
}

function resolveAccentForScheme(
  accentColor: string,
  colorScheme: AppColorScheme,
): string {
  const baseAccent = rgbToHsl(hexToRgb(accentColor));

  if (colorScheme === "light") {
    return rgbToHex(
      hslToRgb({
        hue: baseAccent.hue,
        saturation: clamp(baseAccent.saturation, 0.52, 0.86),
        lightness: clamp(baseAccent.lightness, 0.42, 0.56),
      }),
    );
  }

  return rgbToHex(
    hslToRgb({
      hue: baseAccent.hue,
      saturation: clamp(baseAccent.saturation, 0.6, 0.92),
      lightness: clamp(baseAccent.lightness, 0.68, 0.8),
    }),
  );
}

function buildPalette(
  colorScheme: AppColorScheme,
  accentColor: string,
): AppPalette {
  const basePalette = basePalettes[colorScheme];
  const tint = resolveAccentForScheme(accentColor, colorScheme);
  const primaryContainer =
    colorScheme === "light"
      ? mixColors(basePalette.background, tint, 0.18)
      : mixColors(
          basePalette.background,
          tint,
          colorScheme === "dark" ? 0.34 : 0.28,
        );
  const hero =
    colorScheme === "light"
      ? mixColors(basePalette.background, tint, 0.1)
      : mixColors(
          basePalette.background,
          tint,
          colorScheme === "dark" ? 0.18 : 0.16,
        );
  const heroBorder =
    colorScheme === "light"
      ? mixColors(basePalette.background, tint, 0.24)
      : mixColors(
          basePalette.background,
          tint,
          colorScheme === "dark" ? 0.36 : 0.3,
        );
  const accentSoft =
    colorScheme === "light"
      ? mixColors(basePalette.background, tint, 0.08)
      : mixColors(
          basePalette.background,
          tint,
          colorScheme === "dark" ? 0.14 : 0.12,
        );

  return {
    ...basePalette,
    tint,
    onTint: getReadableTextColor(tint),
    primaryContainer,
    onPrimaryContainer: getReadableTextColor(primaryContainer),
    tabIconSelected: tint,
    hero,
    heroBorder,
    accentSoft,
    inversePrimary: mixColors(basePalette.inverseSurface, tint, 0.55),
  };
}

function buildResolvedPalettes(
  accentColor: string,
): Record<AppColorScheme, AppPalette> {
  return {
    light: buildPalette("light", accentColor),
    dark: buildPalette("dark", accentColor),
    oled: buildPalette("oled", accentColor),
  };
}

export function setThemeAccentColor(accentColor: string): void {
  const normalized = normalizeThemeAccentColor(accentColor);
  if (normalized === activeThemeAccentColor) {
    return;
  }

  activeThemeAccentColor = normalized;
  resolvedPalettes = buildResolvedPalettes(normalized);
}

export function getThemeAccentColor(): string {
  return activeThemeAccentColor;
}

const Colors = {
  get light() {
    return resolvedPalettes.light;
  },
  get dark() {
    return resolvedPalettes.dark;
  },
  get oled() {
    return resolvedPalettes.oled;
  },
} satisfies Record<AppColorScheme, AppPalette>;

export default Colors;
