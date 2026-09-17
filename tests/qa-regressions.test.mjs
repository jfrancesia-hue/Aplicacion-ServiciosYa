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
const notificationsHook = fs.readFileSync(
  "lib/hooks/useNotifications.ts",
  "utf8",
);
const notificationHandler = fs.readFileSync(
  "lib/hooks/useNotificationHandler.ts",
  "utf8",
);
const notificationsData = fs.readFileSync(
  "lib/utils/notificationes.ts",
  "utf8",
);
const micaChat = fs.readFileSync("screens/MicaChat.tsx", "utf8");
const legalExport = fs.readFileSync(
  "scripts/export_public_legal_documents.mjs",
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

test("un toque de notificación tiene un solo manejador de navegación", () => {
  assert.doesNotMatch(
    notificationsHook,
    /addNotificationResponseReceivedListener/,
  );
  assert.match(notificationHandler, /addNotificationResponseReceivedListener/);
  assert.doesNotMatch(notificationsHook, /setNotificationHandler/);
  assert.match(notificationHandler, /setNotificationHandler/);
  assert.doesNotMatch(notificationsHook, /Linking\.openURL/);
});

test("las notificaciones sin foto no inventan un avatar remoto", () => {
  assert.match(notificationsData, /foto_perfil: user\?\.foto_perfil \?\? null/);
  assert.doesNotMatch(notificationsData, /picsum/);
});

test("un pedido cerrado no se muestra activo ni permite elegir presupuesto", () => {
  assert.match(micaChat, /type SearchStage =[^;]+"closed"/);
  assert.match(micaChat, /Este pedido ya no recibe presupuestos/);
  const selectFlow = micaOrder.slice(
    micaOrder.indexOf('if (action === "select")'),
    micaOrder.indexOf("const chat = await findOrCreateChat"),
  );
  assert.match(
    selectFlow,
    /\["cancelado", "cancelada", "finalizado", "finalizada"\]/,
  );
  assert.match(selectFlow, /El pedido ya no est/);
});

test("el control legal compara contenido y no falla solo por CRLF de Windows", () => {
  assert.match(legalExport, /normalizeLineEndings/);
  assert.match(legalExport, /replace\(\/\\r\\n\?\/g, "\\n"\)/);
});
