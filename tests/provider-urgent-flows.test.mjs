import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getProviderProfileCompleteness } from "../lib/utils/providerProfile.ts";
import {
  createServiceSystemContent,
  parseServiceSystemMessage,
} from "../lib/utils/serviceSystemMessage.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [
  config,
  emailMigration,
  emailFunction,
  preferencesFunction,
  emailWebhook,
  urgentMigration,
  urgentFunction,
  categoryScreen,
  contratarHook,
  chatNotification,
] = await Promise.all([
  read("../supabase/config.toml"),
  read(
    "../supabase/migrations/20260804170000_provider_reactivation_emails.sql",
  ),
  read("../supabase/functions/provider-reactivation-emails/index.ts"),
  read("../supabase/functions/provider-email-preferences/index.ts"),
  read("../supabase/functions/provider-email-webhook/index.ts"),
  read(
    "../supabase/migrations/20260804173000_secure_urgent_service_requests.sql",
  ),
  read("../supabase/functions/urgent-service/index.ts"),
  read("../screens/ServiciosPorCategoria.tsx"),
  read("../lib/hooks/useContratar.ts"),
  read("../supabase/functions/send-message-notification/index.ts"),
]);

test("calcula la completitud profesional con los pesos de la campaña", () => {
  const incomplete = getProviderProfileCompleteness({
    nombre: "Ana",
    email: "ana@example.com",
    celular: "3834123456",
    categoria: ["Plomería"],
    provincia: "Catamarca",
    ciudad: "Valle Viejo",
  });
  assert.equal(incomplete.score, 75);
  assert.deepEqual(incomplete.missingCodes, [
    "foto",
    "descripcion",
    "experiencia",
    "horarios",
  ]);

  const complete = getProviderProfileCompleteness({
    nombre: "Ana",
    email: "ana@example.com",
    celular: "3834123456",
    categoria: ["Plomería"],
    provincia: "Catamarca",
    ciudad: "Valle Viejo",
    foto_perfil: "https://example.com/foto.jpg",
    descripcion: "Reparaciones domiciliarias",
    experiencia: "Cinco años",
    horarios: "Lunes a viernes",
  });
  assert.equal(complete.score, 100);
  assert.deepEqual(complete.missingCodes, []);
});

test("registra la conexión urgente como evento del chat", () => {
  const content = createServiceSystemContent({
    kind: "urgent_request_matched",
    title: "Pedido urgente conectado",
    text: "Conversen los detalles y preparen el presupuesto.",
    eventId: "urgent-request-id",
  });
  assert.equal(
    parseServiceSystemMessage(content)?.kind,
    "urgent_request_matched",
  );
});

test("la campaña es limitada, administrada y permite la baja", () => {
  assert.match(
    config,
    /\[functions\.provider-reactivation-emails\][\s\S]*?verify_jwt = true/,
  );
  assert.match(
    config,
    /\[functions\.provider-email-preferences\][\s\S]*?verify_jwt = false/,
  );
  assert.match(emailFunction, /profile\?\.rol !== "admin"/);
  assert.match(emailFunction, /Idempotency-Key/);
  assert.match(emailFunction, /Crear y completar tu perfil no tiene costo/);
  assert.match(emailFunction, /List-Unsubscribe-Post/);
  assert.match(emailMigration, /reminder_number between 1 and 3/);
  assert.match(emailMigration, /interval '7 days'/);
  assert.match(emailMigration, /marketing_email_enabled/);
  assert.match(preferencesFunction, /HMAC/);
  assert.match(preferencesFunction, /marketing_email_enabled: false/);
});

test("el webhook de email verifica firma y ventana temporal", () => {
  assert.match(emailWebhook, /svix-signature/);
  assert.match(emailWebhook, /HMAC/);
  assert.match(emailWebhook, /Math\.abs\([\s\S]*?> 300/);
  assert.match(emailWebhook, /provider_message_id/);
});

test("la urgencia es explícita, acotada por zona y operada desde servidor", () => {
  assert.match(
    config,
    /\[functions\.urgent-service\][\s\S]*?verify_jwt = true/,
  );
  assert.match(urgentFunction, /admin\.auth\.getUser\(bearerToken\(req\)\)/);
  assert.match(urgentMigration, /URGENT_REQUEST_RATE_LIMIT/);
  assert.match(urgentMigration, /limit 3/);
  assert.match(urgentMigration, /worker\.status = 'ONLINE'/);
  assert.match(urgentMigration, /provider\.provincia/);
  assert.match(urgentMigration, /public\.user_blocks/);
  assert.match(urgentMigration, /selected_provider_id = auth\.uid\(\)/);
  assert.doesNotMatch(categoryScreen, /sendUrgentWorkPush/);
  assert.doesNotMatch(contratarHook, /createUrgentWorkAlert/);
});

test("el flujo urgente anterior y la repetición por chat quedan desactivados", () => {
  assert.match(
    config,
    /\[functions\.process-urgent-work-alerts\][\s\S]*?enabled = false/,
  );
  assert.match(urgentMigration, /cron\.unschedule/);
  assert.match(
    urgentMigration,
    /drop policy if exists "urgent_work_alerts_authenticated_insert"/,
  );
  assert.doesNotMatch(chatNotification, /urgent_work_alerts/);
  assert.match(chatNotification, /channelId: "default"/);
});
