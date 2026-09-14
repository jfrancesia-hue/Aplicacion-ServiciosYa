import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authHook = fs.readFileSync("lib/hooks/useAuth.tsx", "utf8");
const chat = fs.readFileSync("screens/ChatIndividual.js", "utf8");
const micaOrder = fs.readFileSync(
  "supabase/functions/mica-order/index.ts",
  "utf8",
);
const providers = fs.readFileSync(
  "supabase/functions/available-providers/index.ts",
  "utf8",
);

test("un cambio de cuenta elimina la caché privada antes de renderizar", () => {
  assert.match(authHook, /queryCacheUserId !== nextUserId/);
  assert.match(authHook, /queryClient\.clear\(\)/);
  assert.match(authHook, /setQueryData\(sessionQueryKey, newSession\)/);
});

test("aceptar una propuesta usa el resumen operativo y no un alert legado", () => {
  const confirmation = chat.slice(
    chat.indexOf("const confirmarReserva"),
    chat.indexOf("const abrirAgendaVisita"),
  );
  assert.match(confirmation, /setPendingPaymentQuote/);
  assert.doesNotMatch(confirmation, /Alert\.alert/);
  assert.match(chat, /QuoteOperationalNoticeModal/);
});

test("una propuesta elegida en MICA crea una reserva de chat aceptable", () => {
  assert.match(micaOrder, /operationalNoticeVersion/);
  assert.match(micaOrder, /operationalNoticeAcceptedAt/);
  assert.match(micaOrder, /from\("chat_quotes"\)\.insert/);
  assert.match(micaOrder, /fee_rate: 0\.1/);
  assert.match(micaOrder, /sourceBudgetId: quote\.id/);
});

test("el listado nacional rechaza provincias extranjeras explícitas", () => {
  assert.match(providers, /const explicitProvince = cleanText/);
  assert.match(providers, /explicitProvince\s*\? resolveProvince/);
  assert.match(providers, /return Boolean\(providerProvince\)/);
});
