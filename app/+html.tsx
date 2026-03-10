import { ScrollViewStyleReset } from "expo-router/html";

import {
    DEFAULT_THEME_PREFERENCE,
    THEME_PREFERENCE_STORAGE_KEY,
    getThemeBackgroundColor,
} from "@/services/theme/themePreferences";

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
const webContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https: ws: wss:",
].join("; ");

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          httpEquiv="Content-Security-Policy"
          content={webContentSecurityPolicy}
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

const themeBootstrapScript = `
(function () {
  try {
    var storedPreference = localStorage.getItem("${THEME_PREFERENCE_STORAGE_KEY}");
    var preference =
      storedPreference === "light" ||
      storedPreference === "dark" ||
      storedPreference === "oled"
        ? storedPreference
        : "${DEFAULT_THEME_PREFERENCE}";
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = preference === "light" ? "light" : "dark";
  } catch (error) {
    document.documentElement.dataset.themePreference = "${DEFAULT_THEME_PREFERENCE}";
    document.documentElement.style.colorScheme = "dark";
  }
})();`;

const responsiveBackground = `
html,
body {
  background-color: ${getThemeBackgroundColor(DEFAULT_THEME_PREFERENCE)};
}
html[data-theme-preference="light"],
html[data-theme-preference="light"] body {
  background-color: ${getThemeBackgroundColor("light")};
}
html[data-theme-preference="dark"],
html[data-theme-preference="dark"] body {
  background-color: ${getThemeBackgroundColor("dark")};
}
html[data-theme-preference="oled"],
html[data-theme-preference="oled"] body {
  background-color: ${getThemeBackgroundColor("oled")};
}`;
