import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const eas = JSON.parse(fs.readFileSync("eas.json", "utf8"));
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
const supabaseSource = fs.readFileSync("lib/supabase.ts", "utf8");
const environmentCheck = fs.readFileSync(
  "scripts/check_internal_release_env.js",
  "utf8",
);

test("la prueba interna genera un AAB y apunta al track internal", () => {
  assert.equal(eas.build.internal.distribution, "store");
  assert.equal(eas.build.internal.environment, "preview");
  assert.equal(eas.build.internal.android.buildType, "app-bundle");
  assert.equal(
    eas.build.internal.env.EXPO_PUBLIC_RELEASE_CHANNEL,
    "internal",
  );
  assert.equal(eas.submit.internal.android.track, "internal");
  assert.equal(eas.submit.internal.android.releaseStatus, "completed");
});

test("la build interna exige un Supabase de pruebas explícito", () => {
  assert.match(supabaseSource, /EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(supabaseSource, /EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(supabaseSource, /releaseChannel === "internal"/);
  assert.match(
    environmentCheck,
    /La build interna fue detenida para no usar Supabase de producción/,
  );
  assert.equal(
    packageJson.scripts["eas-build-pre-install"],
    "node scripts/check_internal_release_env.js",
  );
});

test("la próxima compilación usa un versionCode posterior a la build 95", () => {
  assert.equal(app.expo.version, "96.0.0");
  assert.equal(app.expo.android.versionCode, 96);
});
