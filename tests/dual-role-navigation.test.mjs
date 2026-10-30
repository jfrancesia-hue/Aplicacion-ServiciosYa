import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(
  new URL("../screens/Home.tsx", import.meta.url),
  "utf8",
);
const homeHeader = readFileSync(
  new URL("../components/HomeHeader.tsx", import.meta.url),
  "utf8",
);
const homeQuickAccess = readFileSync(
  new URL("../components/HomeQuickAccessMenu.tsx", import.meta.url),
  "utf8",
);
const providerRegistration = readFileSync(
  new URL("../screens/RegistroTrabajador.tsx", import.meta.url),
  "utf8",
);
const providerCapability = readFileSync(
  new URL("../lib/utils/user.ts", import.meta.url),
  "utf8",
);
const profile = readFileSync(
  new URL("../screens/Perfil.js", import.meta.url),
  "utf8",
);
const capabilityMigration = readFileSync(
  new URL(
    "../supabase/migrations/20261012184050_add_provider_capability.sql",
    import.meta.url,
  ),
  "utf8",
);
const reconciliationMigration = readFileSync(
  new URL(
    "../supabase/migrations/20261012184153_reconcile_provider_capability_legacy_roles.sql",
    import.meta.url,
  ),
  "utf8",
);

test("un cliente autenticado puede iniciar el alta como prestador desde los accesos rápidos", () => {
  assert.match(
    home,
    /const canBecomeProvider = !isGuest && !isProvider && rol !== "admin"/,
  );
  assert.match(home, /navigation\.navigate\("RegistroTrabajador"\)/);
  assert.match(home, /"Quiero ofrecer servicios"/);
  assert.match(home, /<HomeQuickAccessMenu/);
  assert.match(homeQuickAccess, /offerServiceLabel/);
});

test("prestadores y administradores publican con una capacidad independiente", () => {
  assert.match(
    home,
    /const canPublishService = isProvider \|\| rol === "admin"/,
  );
  assert.match(home, /navigation\.navigate\("OfrecerServicio"\)/);
  assert.match(providerCapability, /profile\.provider_enabled === true/);
  assert.match(providerCapability, /profile\.rol === "worker"/);
});

test("el alta activa la capacidad de prestador y vuelve a un Home limpio", () => {
  assert.match(providerRegistration, /provider_enabled: true/);
  assert.match(providerRegistration, /setQueryData\(perfilQueryKey/);
  assert.match(
    providerRegistration,
    /navigation\.reset\(\{ index: 0, routes: \[\{ name: "Home" \}\] \}\)/,
  );
});

test("toda cuenta conserva la posibilidad de solicitar aunque también preste servicios", () => {
  assert.match(home, /publishLabel="Publicar trabajo"/);
  assert.match(
    home,
    /navigation\.navigate\("PublicarNecesidad", \{ view: "new" \}\)/,
  );
  assert.match(profile, /Solicitar trabajos/);
  assert.match(profile, /Publicar un trabajo/);
  assert.match(profile, /Gestionar mis servicios/);
});

test("las acciones de inicio participan del layout y no tapan contenido", () => {
  assert.doesNotMatch(home, /FloatingActionButtonMenu/);
  assert.doesNotMatch(home, /SideQuickAccessMenu/);
  assert.match(home, /onSearchWithMica=/);
  assert.match(homeQuickAccess, /Buscar servicio con MICA/);
  assert.doesNotMatch(homeQuickAccess, /position:\s*["']absolute["']/);
  assert.doesNotMatch(homeHeader, /Consultar a MICA/);
});

test("la base separa la capacidad de prestador y mantiene compatibilidad con builds anteriores", () => {
  assert.match(
    capabilityMigration,
    /add column if not exists provider_enabled boolean not null default false/,
  );
  assert.match(
    capabilityMigration,
    /create trigger normalize_provider_capability/,
  );
  assert.match(reconciliationMigration, /new\.rol::text = 'guest'/);
  assert.match(reconciliationMigration, /new\.provider_enabled := false/);
  assert.match(reconciliationMigration, /set rol = 'worker'/);
});
