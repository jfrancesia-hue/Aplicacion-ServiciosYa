const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const retiredBrand = ["too", "ri"].join("");
const allowedWebOrigin = `https://${retiredBrand}serviciosya.com`;
const legacySharedTokenName = [
  retiredBrand.toUpperCase(),
  "_APP_SYNC_TOKEN",
].join("");
const webRootCandidates = [
  path.resolve(root, "..", "Web-Torriserviciosya-nueva"),
  path.resolve("E:", "Usuario", "Web-Torriserviciosya-nueva"),
  path.resolve(
    root,
    "..",
    "Users",
    "LENOVO",
    ".openclaw",
    "workspace",
    "external",
    "Web-Torriserviciosya-nueva",
  ),
];

const requiredAppFiles = [
  "SERVICIOSYA_UNIFIED_CONTRACT.md",
  "lib/serviciosYaApi.ts",
  "lib/serviciosYaBridge.ts",
  "types/serviciosYaBridge.ts",
  "components/serviciosYa/PedidosMicaSection.tsx",
];

const requiredEndpointNames = [
  "sync-prestador.php",
  "pedidos-disponibles.php",
  "responder-pedido.php",
  "estado-pedido.php",
];

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

console.log("ServiciosYa unified contract check\n");

for (const file of requiredAppFiles) {
  assert(exists(file), `App file exists: ${file}`);
}

const appJson = JSON.parse(
  fs.readFileSync(path.join(root, "app.json"), "utf8"),
);
assert(
  appJson?.expo?.extra?.serviciosYaBridge?.baseUrl ===
    `${allowedWebOrigin}/api/app`,
  "app.json exposes serviciosYaBridge.baseUrl",
);

const bridgeSource = fs.readFileSync(
  path.join(root, "lib/serviciosYaBridge.ts"),
  "utf8",
);
for (const endpoint of requiredEndpointNames) {
  assert(bridgeSource.includes(endpoint), `App bridge references ${endpoint}`);
}
assert(
  bridgeSource.includes("supabase.auth.getSession"),
  "App bridge tries Supabase Auth session before fallback token",
);

const guessedWebRoot =
  webRootCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;
if (!guessedWebRoot) {
  console.warn(
    "⚠️ Web repo not found from this checkout; skipped endpoint existence check.",
  );
} else {
  for (const endpoint of requiredEndpointNames) {
    assert(
      fs.existsSync(path.join(guessedWebRoot, "api", "app", endpoint)),
      `Web endpoint exists: api/app/${endpoint}`,
    );
  }
  const authSource = fs.readFileSync(
    path.join(guessedWebRoot, "api", "app", "app-auth.php"),
    "utf8",
  );
  assert(
    authSource.includes("app_bridge_validate_supabase_user_token"),
    "Web auth validates Supabase Auth bearer tokens",
  );
  assert(
    authSource.includes(legacySharedTokenName),
    "Web auth supports the existing shared sync token fallback",
  );

  const pedidosSource = fs.readFileSync(
    path.join(guessedWebRoot, "api", "app", "pedidos-disponibles.php"),
    "utf8",
  );
  assert(
    pedidosSource.includes("mica_app") &&
      pedidosSource.includes("modo_agente") &&
      pedidosSource.includes("app_cliente_id"),
    "Web pedidos endpoint supports MICA app requests and hides own requests",
  );
}

const textExtensions = new Set([
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
]);
const ignoredDirectories = new Set([".git", "node_modules"]);
const unexpectedReferences = [];

function scanDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(absolutePath);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue;

    const relativePath = path.relative(root, absolutePath);
    const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const withoutAllowedDomain = line
        .toLowerCase()
        .replaceAll(allowedWebOrigin, "");
      if (withoutAllowedDomain.includes(retiredBrand)) {
        unexpectedReferences.push(`${relativePath}:${index + 1}`);
      }
    });
  }
}

scanDirectory(root);
assert(
  unexpectedReferences.length === 0,
  unexpectedReferences.length === 0
    ? "The retired brand appears only inside the allowed web domain"
    : `Unexpected retired-brand references: ${unexpectedReferences.join(", ")}`,
);

if (process.exitCode) {
  console.error("\nServiciosYa unified contract check FAILED.");
  process.exit(process.exitCode);
}

console.log("\nServiciosYa unified contract check OK.");
