import {
    DEFAULT_THEME_ACCENT_COLOR,
    normalizeThemeAccentColor,
} from "@/services/theme/themePreferences";

export type AppColorScheme =
  | "light"
  | "dark"
  | "oled"
  | "monotone-light"
  | "monotone-dark";
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
    text: "#0c1424",
    background: "#ffffff",
    tint: DEFAULT_THEME_ACCENT_COLOR,
    onTint: "#ffffff",
    primaryContainer: "#d3e3fd",
    onPrimaryContainer: "#041e49",
    secondary: "#ff7a59",
    onSecondary: "#ffffff",
    secondaryContainer: "#ffe6de",
    onSecondaryContainer: "#7a2f1b",
    tertiary: "#2dd4bf",
    onTertiary: "#003c34",
    tertiaryContainer: "#ccfbf1",
    onTertiaryContainer: "#134e4a",
    tabIconDefault: "#6a748b",
    tabIconSelected: DEFAULT_THEME_ACCENT_COLOR,
    card: "#ffffff",
    cardAlt: "#f5f7ff",
    muted: "#6a748b",
    border: "#e3e8f5",
    borderSoft: "#eef2fb",
    hero: "#ecf7ff",
    heroBorder: "#cfe9ff",
    accentSoft: "#f1f8ff",
    success: "#16a34a",
    warning: "#f97316",
    danger: "#ef4444",
    dangerContainer: "#fee2e2",
    onDangerContainer: "#7f1d1d",
    surface1: "#f5fbff",
    surface2: "#eef7ff",
    surface3: "#e8f2ff",
    surface4: "#e2edff",
    surface5: "#dbe7ff",
    inverseSurface: "#0c1424",
    inverseOnSurface: "#ffffff",
    inversePrimary: "#a5b4fc",
    shadow: "rgba(16, 24, 40, 0.12)",
  },
  dark: {
    text: "#eef3ff",
    background: "#0b1324",
    tint: "#a8c7fa",
    onTint: "#062e6f",
    primaryContainer: "#284777",
    onPrimaryContainer: "#d7e3ff",
    secondary: "#ffb092",
    onSecondary: "#4a2316",
    secondaryContainer: "#6a3423",
    onSecondaryContainer: "#ffd9c9",
    tertiary: "#2ee6cf",
    onTertiary: "#003833",
    tertiaryContainer: "#0f5b54",
    onTertiaryContainer: "#c5fff5",
    tabIconDefault: "#b4bdd6",
    tabIconSelected: "#a8c7fa",
    card: "#111b2f",
    cardAlt: "#18233a",
    muted: "#c4cbe0",
    border: "#2a3550",
    borderSoft: "#364263",
    hero: "#162546",
    heroBorder: "#2a406c",
    accentSoft: "#1a2742",
    success: "#5ee18b",
    warning: "#ffb870",
    danger: "#ff7a7a",
    dangerContainer: "#6f1f1f",
    onDangerContainer: "#ffd9d9",
    surface1: "#0f182d",
    surface2: "#131c33",
    surface3: "#17223a",
    surface4: "#1c2842",
    surface5: "#212e4b",
    inverseSurface: "#eef3ff",
    inverseOnSurface: "#182033",
    inversePrimary: "#7cc0ff",
    shadow: "rgba(0, 0, 0, 0.55)",
  },
  oled: {
    text: "#eef3ff",
    background: "#000000",
    tint: "#a8c7fa",
    onTint: "#062e6f",
    primaryContainer: "#102b52",
    onPrimaryContainer: "#d7e3ff",
    secondary: "#ffb092",
    onSecondary: "#3d1d13",
    secondaryContainer: "#4f2619",
    onSecondaryContainer: "#ffd9c9",
    tertiary: "#2ee6cf",
    onTertiary: "#003833",
    tertiaryContainer: "#0a4a44",
    onTertiaryContainer: "#c5fff5",
    tabIconDefault: "#b0b9d4",
    tabIconSelected: "#a8c7fa",
    card: "#050b17",
    cardAlt: "#0a1221",
    muted: "#c8cfe6",
    border: "#141c2f",
    borderSoft: "#1e2740",
    hero: "#050d20",
    heroBorder: "#1b2b4d",
    accentSoft: "#0b1326",
    success: "#5ee18b",
    warning: "#ffb870",
    danger: "#ff7a7a",
    dangerContainer: "#6f1f1f",
    onDangerContainer: "#ffd9d9",
    surface1: "#030711",
    surface2: "#060b17",
    surface3: "#0a101f",
    surface4: "#0e1528",
    surface5: "#121a31",
    inverseSurface: "#eef3ff",
    inverseOnSurface: "#0b1324",
    inversePrimary: "#7cc0ff",
    shadow: "rgba(0, 0, 0, 0.92)",
  },
  "monotone-light": {
    text: "#000000",
    background: "#ffffff",
    tint: "#000000",
    onTint: "#ffffff",
    primaryContainer: "#e6e6e6",
    onPrimaryContainer: "#000000",
    secondary: "#1a1a1a",
    onSecondary: "#ffffff",
    secondaryContainer: "#ededed",
    onSecondaryContainer: "#000000",
    tertiary: "#2a2a2a",
    onTertiary: "#ffffff",
    tertiaryContainer: "#e1e1e1",
    onTertiaryContainer: "#000000",
    tabIconDefault: "#4d4d4d",
    tabIconSelected: "#000000",
    card: "#ffffff",
    cardAlt: "#f5f5f5",
    muted: "#3d3d3d",
    border: "#d9d9d9",
    borderSoft: "#e6e6e6",
    hero: "#f2f2f2",
    heroBorder: "#d6d6d6",
    accentSoft: "#f7f7f7",
    success: "#1f1f1f",
    warning: "#2b2b2b",
    danger: "#333333",
    dangerContainer: "#e9e9e9",
    onDangerContainer: "#000000",
    surface1: "#fafafa",
    surface2: "#f2f2f2",
    surface3: "#ededed",
    surface4: "#e6e6e6",
    surface5: "#dfdfdf",
    inverseSurface: "#000000",
    inverseOnSurface: "#ffffff",
    inversePrimary: "#000000",
    shadow: "rgba(0, 0, 0, 0.15)",
  },
  "monotone-dark": {
    text: "#ffffff",
    background: "#0b0b0b",
    tint: "#ffffff",
    onTint: "#000000",
    primaryContainer: "#1a1a1a",
    onPrimaryContainer: "#ffffff",
    secondary: "#e6e6e6",
    onSecondary: "#000000",
    secondaryContainer: "#242424",
    onSecondaryContainer: "#ffffff",
    tertiary: "#d6d6d6",
    onTertiary: "#000000",
    tertiaryContainer: "#202020",
    onTertiaryContainer: "#ffffff",
    tabIconDefault: "#b3b3b3",
    tabIconSelected: "#ffffff",
    card: "#141414",
    cardAlt: "#191919",
    muted: "#c7c7c7",
    border: "#262626",
    borderSoft: "#2f2f2f",
    hero: "#121212",
    heroBorder: "#2a2a2a",
    accentSoft: "#101010",
    success: "#f0f0f0",
    warning: "#dcdcdc",
    danger: "#cfcfcf",
    dangerContainer: "#2b2b2b",
    onDangerContainer: "#ffffff",
    surface1: "#0f0f0f",
    surface2: "#141414",
    surface3: "#181818",
    surface4: "#1d1d1d",
    surface5: "#222222",
    inverseSurface: "#ffffff",
    inverseOnSurface: "#000000",
    inversePrimary: "#ffffff",
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
  if (colorScheme === "monotone-light" || colorScheme === "monotone-dark") {
    return {
      ...basePalette,
      tint: basePalette.tint,
      onTint: basePalette.onTint,
      primaryContainer: basePalette.primaryContainer,
      onPrimaryContainer: basePalette.onPrimaryContainer,
      tabIconSelected: basePalette.tabIconSelected,
      hero: basePalette.hero,
      heroBorder: basePalette.heroBorder,
      accentSoft: basePalette.accentSoft,
      inversePrimary: basePalette.inversePrimary,
    };
  }
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
    "monotone-light": buildPalette("monotone-light", accentColor),
    "monotone-dark": buildPalette("monotone-dark", accentColor),
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
  get "monotone-light"() {
    return resolvedPalettes["monotone-light"];
  },
  get "monotone-dark"() {
    return resolvedPalettes["monotone-dark"];
  },
} satisfies Record<AppColorScheme, AppPalette>;

export default Colors;
