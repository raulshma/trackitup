const {
  createRunOncePlugin,
  withAndroidStyles,
} = require("@expo/config-plugins");

function upsertStyleItem(items, name, value) {
  const nextItems = Array.isArray(items) ? [...items] : items ? [items] : [];
  const index = nextItems.findIndex((item) => item?.$?.name === name);

  if (index >= 0) {
    nextItems[index] = {
      ...nextItems[index],
      _: value,
    };

    return nextItems;
  }

  nextItems.push({
    $: { name },
    _: value,
  });

  return nextItems;
}

function withTrackItUpAndroidSplashTheme(config) {
  return withAndroidStyles(config, (stylesConfig) => {
    const resources = stylesConfig.modResults.resources ?? {};
    const styles = Array.isArray(resources.style) ? [...resources.style] : [];

    const nextStyles = styles.map((style) => {
      if (style?.$?.name !== "BootTheme") {
        return style;
      }

      const nextItems = upsertStyleItem(
        upsertStyleItem(
          style.item,
          "windowSplashScreenBackground",
          "@color/bootsplash_background",
        ),
        "windowSplashScreenIconBackgroundColor",
        "@android:color/transparent",
      );

      return {
        ...style,
        item: nextItems,
      };
    });

    stylesConfig.modResults = {
      ...stylesConfig.modResults,
      resources: {
        ...resources,
        style: nextStyles,
      },
    };

    return stylesConfig;
  });
}

module.exports = createRunOncePlugin(
  withTrackItUpAndroidSplashTheme,
  "with-trackitup-android-splash-theme",
  "1.0.0",
);
