const {
  createRunOncePlugin,
  withAndroidManifest,
  withAppBuildGradle,
} = require("expo/config-plugins");

const pkg = {
  name: "with-trackitup-android-abi-splits",
  version: "1.0.0",
};

const MINIFY_FLAG =
  "def enableMinifyInReleaseBuilds = (findProperty('android.enableMinifyInReleaseBuilds') ?: false).toBoolean()";
const ABI_FLAG = "def enableSeparateBuildPerCPUArchitecture = true";
const ABI_DEFINITIONS = `${MINIFY_FLAG}
${ABI_FLAG}
def supportedAbis = ((findProperty('reactNativeArchitectures') ?: 'armeabi-v7a,arm64-v8a,x86,x86_64') as String)
    .split(',')
    .collect { it.trim() }
    .findAll { !it.isEmpty() }`;

const PACKAGING_OPTIONS = "    packagingOptions {";
const ABI_SPLITS_BLOCK = `    splits {
        abi {
            reset()
            enable enableSeparateBuildPerCPUArchitecture
            universalApk false
            include(*supportedAbis)
        }
    }
    packagingOptions {`;

const withTrackItUpAndroidAbiSplits = (config) => {
  config = withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];

    if (!application || !application["meta-data"]) {
      return modConfig;
    }

    application["meta-data"] = application["meta-data"].filter((entry) => {
      const name = entry?.$?.["android:name"];
      return !(
        typeof name === "string" && name.startsWith("expo.modules.updates.")
      );
    });

    return modConfig;
  });

  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    if (contents.includes(ABI_FLAG)) {
      if (!contents.includes("include(*supportedAbis)")) {
        contents = contents.replace(PACKAGING_OPTIONS, ABI_SPLITS_BLOCK);
      }

      modConfig.modResults.contents = contents;
      return modConfig;
    }

    if (!contents.includes(MINIFY_FLAG)) {
      throw new Error(
        "TrackItUp ABI split plugin could not find the release minify flag anchor in android/app/build.gradle.",
      );
    }

    contents = contents.replace(MINIFY_FLAG, ABI_DEFINITIONS);

    if (!contents.includes("include(*supportedAbis)")) {
      if (!contents.includes(PACKAGING_OPTIONS)) {
        throw new Error(
          "TrackItUp ABI split plugin could not find the Android packagingOptions block in android/app/build.gradle.",
        );
      }

      contents = contents.replace(PACKAGING_OPTIONS, ABI_SPLITS_BLOCK);
    }

    modConfig.modResults.contents = contents;

    return modConfig;
  });
};

module.exports = createRunOncePlugin(
  withTrackItUpAndroidAbiSplits,
  pkg.name,
  pkg.version,
);
