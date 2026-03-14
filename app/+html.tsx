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
const clerkScriptSource = "https://*.clerk.accounts.dev";
const clerkImageSource = "https://img.clerk.com";
const clerkChallengeFrameSource = "https://challenges.cloudflare.com";
const webScriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"]),
  clerkScriptSource,
].join(" ");

const webContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  `img-src 'self' data: blob: ${clerkImageSource}`,
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src ${webScriptSources}`,
  "worker-src 'self' blob:",
  `frame-src 'self' ${clerkChallengeFrameSource}`,
  "connect-src 'self' https: ws: wss:",
].join("; ");

// Note: `frame-ancestors` is intentionally omitted here.
// Browsers ignore that directive when CSP is delivered via a <meta> tag;
// it must be sent as an HTTP response header by the web host instead.

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
        <meta
          name="theme-color"
          content={getThemeBackgroundColor(DEFAULT_THEME_PREFERENCE)}
        />

        <link rel="preconnect" href="https://img.clerk.com" crossOrigin="" />

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
      storedPreference === "oled" ||
      storedPreference === "monotone-light" ||
      storedPreference === "monotone-dark"
        ? storedPreference
        : "${DEFAULT_THEME_PREFERENCE}";
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme =
      preference === "light" || preference === "monotone-light" ? "light" : "dark";
  } catch (error) {
    document.documentElement.dataset.themePreference = "${DEFAULT_THEME_PREFERENCE}";
    document.documentElement.style.colorScheme = "dark";
  }
})();`;

const responsiveBackground = `
html,
body {
  color-scheme: dark;
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
}
html[data-theme-preference="monotone-light"],
html[data-theme-preference="monotone-light"] body {
  background-color: ${getThemeBackgroundColor("monotone-light")};
}
html[data-theme-preference="monotone-dark"],
html[data-theme-preference="monotone-dark"] body {
  background-color: ${getThemeBackgroundColor("monotone-dark")};
}
}`;
