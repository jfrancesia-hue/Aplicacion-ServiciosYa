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
const urgentPolicyAdminMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812184000_urgent_policy_admin_controls.sql",
    import.meta.url,
  ),
  "utf8",
);
const progressiveUrgencyDisciplineMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812191000_activate_progressive_urgency_discipline.sql",
    import.meta.url,
  ),
  "utf8",
);
const canonicalChatParticipantsMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812185000_fix_canonical_chat_participants.sql",
    import.meta.url,
  ),
  "utf8",
);
const scheduledProcessorsSecurityMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812186000_secure_scheduled_processors.sql",
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
const legalConstants = await readFile(
  new URL("../lib/constants/legal.ts", import.meta.url),
  "utf8",
);
const legalDocuments = await readFile(
  new URL("../lib/legal/documents.ts", import.meta.url),
  "utf8",
);
const legalAcceptancesMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812187000_versioned_legal_acceptances.sql",
    import.meta.url,
  ),
  "utf8",
);
const criminalRecordsMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812188000_stop_private_criminal_record_collection.sql",
    import.meta.url,
  ),
  "utf8",
);
const consumerRequestsMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812189000_consumer_withdrawal_and_cancellation_requests.sql",
    import.meta.url,
  ),
  "utf8",
);
const privateVerificationMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812190000_private_verification_documents.sql",
    import.meta.url,
  ),
  "utf8",
);
const availableProvidersFunction = await readFile(
  new URL(
    "../supabase/functions/available-providers/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const registrationLegalSources = (
  await Promise.all(
    [
      "../screens/RegistroCliente.tsx",
      "../screens/RegistroTrabajador.tsx",
      "../screens/CrearPerfil.js",
      "../screens/LoginSeleccion.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  )
).join("\n");

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

test("los procesadores programados exigen un secreto de Vault o service role", () => {
  assert.match(scheduledProcessorsSecurityMigration, /vault\.create_secret/);
  assert.match(
    scheduledProcessorsSecurityMigration,
    /verify_marketplace_cron_secret/,
  );
  assert.match(
    scheduledProcessorsSecurityMigration,
    /x-marketplace-cron-secret/,
  );
  for (const processor of [
    transactionalNotificationsFunction,
    urgentProcessor,
  ]) {
    assert.match(processor, /isAuthorizedProcessorRequest/);
    assert.match(processor, /status: 401/);
    assert.ok(
      processor.indexOf("isAuthorizedProcessorRequest(req") <
        processor.indexOf("claim_"),
    );
  }
});

test("el procesador conserva correo pendiente cuando todav\u00eda no hay proveedor configurado", () => {
  assert.match(transactionalNotificationsFunction, /RESEND_API_KEY/);
  assert.match(transactionalNotificationsFunction, /TRANSACTIONAL_EMAIL_FROM/);
  assert.match(transactionalNotificationsFunction, /waiting_configuration/);
});

test("el panel muestra la salud transaccional sin exponer secretos", () => {
  assert.match(operationalDashboard, /notification-health/);
  assert.match(operationalDashboard, /emailConfigured/);
  assert.match(operationalDashboard, /waitingEmail/);
  assert.doesNotMatch(
    operationalDashboard,
    /RESEND_API_KEY[^\n]{0,120}(return|json)\s*[:=(]/,
  );
  assert.match(
    transactionalNotificationsFunction,
    /eq\("email_status", "waiting_configuration"\)/,
  );
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

test("la política de urgencias fija el máximo de 20 minutos y audita cambios administrativos", () => {
  assert.match(
    urgentPolicyAdminMigration,
    /check \(sla_minutes between 5 and 20\)/,
  );
  assert.match(
    urgentPolicyAdminMigration,
    /check \(reminder_minutes < sla_minutes\)/,
  );
  assert.match(urgentPolicyAdminMigration, /urgent_work_policy_audit/);
  assert.match(urgentPolicyAdminMigration, /set_urgent_work_policy/);
  assert.match(urgentPolicyAdminMigration, /u\.rol::text = 'admin'/);
  assert.match(operationalDashboard, /update-urgency-policy/);
  assert.match(operationalDashboard, /p_updated_by: adminUserId/);
});

test("la política A aplica bloques nuevos de tres y escala 7, 14 y 30 días", () => {
  assert.match(
    progressiveUrgencyDisciplineMigration,
    /enforcement_enabled = true/,
  );
  assert.match(progressiveUrgencyDisciplineMigration, /missed_threshold = 3/);
  assert.match(progressiveUrgencyDisciplineMigration, /window_days = 30/);
  assert.match(
    progressiveUrgencyDisciplineMigration,
    /recurrence_window_days = 90/,
  );
  assert.match(
    progressiveUrgencyDisciplineMigration,
    /second_suspension_days = 14/,
  );
  assert.match(
    progressiveUrgencyDisciplineMigration,
    /subsequent_suspension_days = 30/,
  );
  assert.match(
    progressiveUrgencyDisciplineMigration,
    /not m\.enforcement_applied/,
  );
  assert.match(
    progressiveUrgencyDisciplineMigration,
    /urgent_work_discipline_events/,
  );
  assert.match(
    progressiveUrgencyDisciplineMigration,
    /new\.occurred_at < v_policy\.enforcement_started_at/,
  );
});

test("chat protegido, urgencias y pagos usan los participantes canónicos", () => {
  assert.match(
    canonicalChatParticipantsMigration,
    /create or replace function public\.enforce_protected_chat_content/,
  );
  assert.match(
    canonicalChatParticipantsMigration,
    /create or replace function public\.create_urgent_work_alert/,
  );
  assert.doesNotMatch(canonicalChatParticipantsMigration, /c\.usuario_[12]/);
  assert.doesNotMatch(paymentPreference, /chat\.usuario_[12]/);
  assert.match(paymentPreference, /select\("id,participant_a,participant_b"\)/);
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
  assert.match(quoteNoticeModal, /LegalDocument/);
  assert.match(quoteNoticeModal, /Ver términos y condiciones vigentes/);
  assert.match(paymentPreference, /operationalNotice/);
  assert.match(paymentPreference, /operational_notice_accepted_at/);
});

test("los flujos de registro integran documentos legales versionados sin descargo absoluto", () => {
  assert.match(legalConstants, /inicio\.serviciosya\.info/);
  assert.doesNotMatch(legalConstants, /inicio\.tooriserviciosya\.info/);
  assert.match(registrationLegalSources, /LegalDocument/);
  assert.match(registrationLegalSources, /document: ["']terms["']/);
  assert.match(registrationLegalSources, /document: ["']privacy["']/);
  assert.match(legalDocuments, /comisión de conexión del 10%/i);
  assert.match(legalAcceptancesMigration, /accept_current_legal_documents/);
  assert.doesNotMatch(
    registrationLegalSources,
    /no asume responsabilidad alguna/i,
  );
});

test("arrepentimiento y baja pueden pedirse sin iniciar sesión y llegan al panel", () => {
  assert.match(
    consumerRequestsMigration,
    /to anon, authenticated, service_role/,
  );
  assert.match(consumerRequestsMigration, /request_code/);
  assert.match(consumerRequestsMigration, /interval '24 hours'/);
  assert.match(operationalDashboard, /consumer-right-requests/);
  assert.match(registrationLegalSources, /BOTÓN DE ARREPENTIMIENTO/);
  assert.match(registrationLegalSources, /BOTÓN DE BAJA DE SERVICIO/);
});

test("los documentos de verificación nuevos son privados y no se exponen al buscar", () => {
  assert.match(privateVerificationMigration, /'verification-documents'/);
  assert.match(privateVerificationMigration, /public, file_size_limit/);
  assert.match(
    privateVerificationMigration,
    /public\.is_operational_admin\(\)/,
  );
  assert.match(
    criminalRecordsMigration,
    /CRIMINAL_RECORD_DOCUMENTS_NOT_ACCEPTED/,
  );
  assert.doesNotMatch(
    availableProvidersFunction,
    /matricula,antecedentes|antecedentes_url/,
  );
  assert.match(availableProvidersFunction, /auth\.getUser\(token\)/);
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
