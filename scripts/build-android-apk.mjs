import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const androidDir = path.join(projectRoot, "android");
const gradleWrapper =
  process.platform === "win32" ? "gradlew.bat" : "./gradlew";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["expo", "prebuild", "--clean", "--platform", "android"]);

if (!existsSync(androidDir)) {
  console.error(
    "Expected Expo prebuild to generate the android folder, but it was not created.",
  );
  process.exit(1);
}

run(gradleWrapper, ["assembleRelease"], {
  cwd: androidDir,
});
