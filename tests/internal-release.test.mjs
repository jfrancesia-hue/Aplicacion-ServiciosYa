import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const eas = JSON.parse(fs.readFileSync("eas.json", "utf8"));
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
const supabaseSource = fs.readFileSync("lib/supabase.ts", "utf8");
const androidManifest = fs.readFileSync(
  "android/app/src/main/AndroidManifest.xml",
  "utf8",
);
const wellKnownHtaccess = fs.readFileSync(
  "website/.well-known/.htaccess",
  "utf8",
);
const inviteHtaccess = fs.readFileSync("website/invite/.htaccess", "utf8");
const assetLinks = JSON.parse(
  fs.readFileSync("website/.well-known/assetlinks.json", "utf8"),
);
const appleAppSiteAssociation = JSON.parse(
  fs.readFileSync(
    "website/.well-known/apple-app-site-association",
    "utf8",
  ),
);
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

test("la build interna exige una selección explícita del entorno de datos", () => {
  assert.match(supabaseSource, /EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(supabaseSource, /EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(supabaseSource, /releaseChannel === "internal"/);
  assert.match(
    environmentCheck,
    /La build interna fue detenida para no usar Supabase de producción/,
  );
  assert.equal(
    eas.build.internal.env.EXPO_PUBLIC_INTERNAL_USES_PRODUCTION,
    "true",
  );
  assert.equal(
    packageJson.scripts["eas-build-pre-install"],
    "node scripts/check_internal_release_env.js",
  );
});

test("la próxima compilación conserva la versión configurada 96", () => {
  assert.equal(app.expo.version, "96.0.0");
  assert.equal(app.expo.android.versionCode, 96);
  assert.equal(app.expo.ios.buildNumber, "96");
});

test("Android 36 y los enlaces verificados usan serviciosya.site", () => {
  const buildProperties = app.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-build-properties",
  );
  assert.equal(buildProperties[1].android.compileSdkVersion, 36);
  assert.equal(buildProperties[1].android.targetSdkVersion, 36);
  assert.deepEqual(
    [...app.expo.android.blockedPermissions].sort(),
    [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ].sort(),
  );
  assert.match(
    androidManifest,
    /READ_EXTERNAL_STORAGE" tools:node="remove"/,
  );
  assert.match(
    androidManifest,
    /WRITE_EXTERNAL_STORAGE" tools:node="remove"/,
  );
  assert.deepEqual(app.expo.ios.associatedDomains, [
    "applinks:serviciosya.site",
  ]);

  const hosts = app.expo.android.intentFilters.flatMap((filter) =>
    filter.data.map((entry) => entry.host).filter(Boolean),
  );
  assert.deepEqual([...new Set(hosts)], ["serviciosya.site"]);
  assert.equal(
    assetLinks[0].target.package_name,
    "com.alex_6775.appTrabajo",
  );
  assert.equal(
    appleAppSiteAssociation.applinks.details[0].appID,
    "HHY5MJ22J3.com.alex-6775.appTrabajo",
  );
  assert.match(wellKnownHtaccess, /apple-app-site-association/);
  assert.match(wellKnownHtaccess, /application\/json/);
  assert.match(inviteHtaccess, /RewriteRule \^ index\.html \[L\]/);
});
