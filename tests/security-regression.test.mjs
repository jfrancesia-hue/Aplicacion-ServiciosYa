import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getPaymentReturnParam } from "../lib/utils/paymentReturn.ts";

const chatSource = await readFile(
  new URL("../screens/ChatIndividual.js", import.meta.url),
  "utf8",
);
const supabaseConfig = await readFile(
  new URL("../supabase/config.toml", import.meta.url),
  "utf8",
);
const operationalMigration = await readFile(
  new URL(
    "../supabase/migrations/20260728190000_operational_metrics_verified_reviews.sql",
    import.meta.url,
  ),
  "utf8",
);
const operationalDashboard = await readFile(
  new URL(
    "../supabase/functions/operational-dashboard/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const paymentPreference = await readFile(
  new URL(
    "../supabase/functions/create-payment-preference/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const micaOrder = await readFile(
  new URL("../supabase/functions/mica-order/index.ts", import.meta.url),
  "utf8",
);
const protectedChatMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812110000_protected_quotes_and_service_incidents.sql",
    import.meta.url,
  ),
  "utf8",
);
const transactionalNotificationsMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812170000_transactional_notification_outbox.sql",
    import.meta.url,
  ),
  "utf8",
);
const transactionalNotificationsFunction = await readFile(
  new URL(
    "../supabase/functions/process-transactional-notifications/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const urgentSlaMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812180000_urgent_work_sla.sql",
    import.meta.url,
  ),
  "utf8",
);
const urgentProcessor = await readFile(
  new URL(
    "../supabase/functions/process-urgent-work-alerts/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const messageNotification = await readFile(
  new URL(
    "../supabase/functions/send-message-notification/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const quoteNoticeModal = await readFile(
  new URL(
    "../components/quotes/QuoteOperationalNoticeModal.tsx",
    import.meta.url,
  ),
  "utf8",
);
const bilateralReviewsMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812183000_bilateral_service_reviews.sql",
    import.meta.url,
  ),
  "utf8",
);

test("el cliente no contiene credenciales ni llama directo a Mercado Pago", () => {
  assert.equal(chatSource.includes(`${["APP", "USR"].join("_")}-`), false);
  assert.doesNotMatch(
    chatSource,
    /api\.mercadopago\.com\/checkout\/preferences/,
  );
  assert.match(chatSource, /create-payment-preference/);
  assert.match(chatSource, /verify-payment/);
});

test("las funciones de pago exigen JWT", () => {
  assert.match(
    supabaseConfig,
    /\[functions\.create-payment-preference\][\s\S]*?verify_jwt = true/,
  );
  assert.match(
    supabaseConfig,
    /\[functions\.verify-payment\][\s\S]*?verify_jwt = true/,
  );
  assert.match(
    supabaseConfig,
    /\[functions\.operational-dashboard\][\s\S]*?verify_jwt = true/,
  );
});

test("la comisión es 10% tanto en chat directo como en MICA", () => {
  assert.match(paymentPreference, /COMMISSION_RATE = 0\.1/);
  assert.match(micaOrder, /quote\.amount \* 0\.1/);
  assert.doesNotMatch(paymentPreference, /15%|0\.15/);
  assert.doesNotMatch(micaOrder, /quote\.amount \* 0\.15/);
});

test("el servidor protege contacto y montos y conserva el canal de reclamos", () => {
  assert.match(protectedChatMigration, /CHAT_CONTACT_BLOCKED/);
  assert.match(protectedChatMigration, /CHAT_PRICE_REQUIRES_QUOTE/);
  assert.match(protectedChatMigration, /CHAT_QUOTE_PROVIDER_ONLY/);
  assert.match(protectedChatMigration, /report_service_job_incident/);
  assert.match(protectedChatMigration, /service_job_incidents/);
});

test("el panel operativo exige rol administrador y no lee conversaciones", () => {
  assert.match(operationalDashboard, /profile\?\.rol === "admin"/);
  assert.doesNotMatch(
    operationalDashboard,
    /\.from\("mensajes"\)[\s\S]{0,160}\.select\("(contenido|\*)"\)/,
  );
});

test("las calificaciones requieren un pago aprobado y aplican RLS", () => {
  assert.match(operationalMigration, /v_payment\.status <> 'approved'/);
  assert.match(
    operationalMigration,
    /alter table public\.service_job_reviews enable row level security/,
  );
  assert.match(chatSource, /submit_service_job_review/);
});

test("la telemetría rechaza campos sensibles", () => {
  assert.match(operationalMigration, /'telefono'/);
  assert.match(operationalMigration, /'transcript'/);
  assert.match(operationalMigration, /SENSITIVE_EVENT_CONTEXT/);
});

test("las notificaciones transaccionales son idempotentes y se reclaman con bloqueo", () => {
  assert.match(
    transactionalNotificationsMigration,
    /event_key text not null unique/,
  );
  assert.match(transactionalNotificationsMigration, /for update skip locked/);
  assert.match(
    transactionalNotificationsMigration,
    /notificaciones_transactional_outbox_uidx/,
  );
  assert.match(
    transactionalNotificationsFunction,
    /claim_transactional_notifications/,
  );
  assert.match(
    transactionalNotificationsFunction,
    /transactional_outbox_id: row\.id/,
  );
});

test("el procesador conserva correo pendiente cuando todav\u00eda no hay proveedor configurado", () => {
  assert.match(transactionalNotificationsFunction, /RESEND_API_KEY/);
  assert.match(transactionalNotificationsFunction, /TRANSACTIONAL_EMAIL_FROM/);
  assert.match(transactionalNotificationsFunction, /waiting_configuration/);
});

test("las urgencias exigen respuesta expl\u00edcita dentro de 20 minutos", () => {
  assert.match(urgentSlaMigration, /sla_minutes integer not null default 20/);
  assert.match(urgentSlaMigration, /respond_to_urgent_work_alert/);
  assert.match(
    urgentSlaMigration,
    /p_response not in \('accepted', 'declined'\)/,
  );
  assert.doesNotMatch(
    urgentProcessor,
    /notification\?\.leido|\.from\("mensajes"\).*reply/s,
  );
});

test("las urgencias vencidas se registran y se reasignan con disciplina configurable", () => {
  assert.match(urgentSlaMigration, /urgent_work_misses/);
  assert.match(
    urgentSlaMigration,
    /enforcement_enabled boolean not null default false/,
  );
  assert.match(urgentProcessor, /createReplacement/);
  assert.match(urgentProcessor, /max_reassignments/);
});

test("los mensajes comunes ya no crean falsas urgencias", () => {
  assert.doesNotMatch(messageNotification, /urgent_work_alerts/);
  assert.match(messageNotification, /channelId: "default"/);
});

test("el resumen operativo distingue la comisi\u00f3n del pago del trabajo", () => {
  assert.match(
    quoteNoticeModal,
    /comisi\u00f3n de conexi\u00f3n y confirmaci\u00f3n/,
  );
  assert.match(quoteNoticeModal, /no es un adelanto del trabajo/);
  assert.match(quoteNoticeModal, /Seguir conversando/);
  assert.match(paymentPreference, /operationalNotice/);
  assert.match(paymentPreference, /operational_notice_accepted_at/);
});

test("la reputación es bilateral sin sanciones automáticas por reseña", () => {
  assert.match(bilateralReviewsMigration, /submit_client_job_review/);
  assert.match(bilateralReviewsMigration, /ONLY_PROVIDER_CAN_REVIEW_CLIENT/);
  assert.match(bilateralReviewsMigration, /job_status <> 'completed'/);
  assert.match(bilateralReviewsMigration, /client_trust_summary/);
  assert.doesNotMatch(bilateralReviewsMigration, /suspend|ban|block/i);
});

test("interpreta el retorno aprobado de Mercado Pago", () => {
  const url =
    "solucionesya://presupuesto-confirmado?status=approved&payment_record_id=record-1&payment_id=123456";
  assert.equal(getPaymentReturnParam(url, "status"), "approved");
  assert.equal(getPaymentReturnParam(url, "payment_record_id"), "record-1");
  assert.equal(getPaymentReturnParam(url, "payment_id"), "123456");
});

test("decodifica parámetros y no confunde nombres parciales", () => {
  const url =
    "solucionesya://presupuesto-confirmado?collection_status=pending&payment_record_id=abc%20123";
  assert.equal(getPaymentReturnParam(url, "status"), null);
  assert.equal(getPaymentReturnParam(url, "collection_status"), "pending");
  assert.equal(getPaymentReturnParam(url, "payment_record_id"), "abc 123");
});
