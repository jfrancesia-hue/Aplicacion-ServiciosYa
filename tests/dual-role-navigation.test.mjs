import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(
  new URL("../screens/Home.tsx", import.meta.url),
  "utf8",
);
const quickMenu = readFileSync(
  new URL("../components/SideQuickAccessMenu.tsx", import.meta.url),
  "utf8",
);
const providerRegistration = readFileSync(
  new URL("../screens/RegistroTrabajador.tsx", import.meta.url),
  "utf8",
);

test("un cliente autenticado puede iniciar el alta como prestador desde el menu rapido", () => {
  assert.match(home, /const canBecomeProvider = !isGuest && rol === "user"/);
  assert.match(home, /navigation\.navigate\("RegistroTrabajador"\)/);
  assert.match(
    home,
    /offerServiceMode=\{canBecomeProvider \? "register" : "publish"\}/,
  );
  assert.match(quickMenu, /Quiero ofrecer servicios/);
  assert.match(quickMenu, /Completá tu perfil de prestador/);
});

test("prestadores y administradores publican sin perder su rol", () => {
  assert.match(home, /const canPublishService = isWorker \|\| rol === "admin"/);
  assert.match(home, /navigation\.navigate\("OfrecerServicio"\)/);
});

test("el alta como prestador actualiza el rol visible y vuelve a un Home limpio", () => {
  assert.match(providerRegistration, /setQueryData\(perfilQueryKey/);
  assert.match(
    providerRegistration,
    /navigation\.reset\(\{ index: 0, routes: \[\{ name: "Home" \}\] \}\)/,
  );
});
