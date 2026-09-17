import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildQuotePricing,
  calculateQuoteReferenceTotal,
} from "../lib/utils/quotePricing.ts";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260812120000_manual_service_requests_and_applications.sql",
    import.meta.url,
  ),
  "utf8",
);
const publicationScreen = await readFile(
  new URL("../screens/PublicarNecesidad.tsx", import.meta.url),
  "utf8",
);
const workerHome = await readFile(
  new URL("../components/home/WorkerHomeView.tsx", import.meta.url),
  "utf8",
);
const pricingMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812130000_quote_pricing_modes.sql",
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
const scheduleMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812140000_service_schedule_options.sql",
    import.meta.url,
  ),
  "utf8",
);
const schedulePanel = await readFile(
  new URL("../components/chat/ServiceSchedulePanel.tsx", import.meta.url),
  "utf8",
);
const jobsMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812150000_my_pending_jobs_dashboard.sql",
    import.meta.url,
  ),
  "utf8",
);
const jobsOverview = await readFile(
  new URL("../components/jobs/JobsOverview.tsx", import.meta.url),
  "utf8",
);
const incidentIntakeMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812160000_mica_incident_intake.sql",
    import.meta.url,
  ),
  "utf8",
);
const incidentIntakeModal = await readFile(
  new URL("../components/chat/MicaIncidentIntakeModal.tsx", import.meta.url),
  "utf8",
);
const argentinaLocationMigration = await readFile(
  new URL(
    "../supabase/migrations/20260914145910_argentina_location_matching.sql",
    import.meta.url,
  ),
  "utf8",
);
const workerScopeMigration = await readFile(
  new URL(
    "../supabase/migrations/20260914151108_harden_argentina_worker_request_scope.sql",
    import.meta.url,
  ),
  "utf8",
);
const categoryAliasMigration = await readFile(
  new URL(
    "../supabase/migrations/20260914203000_match_worker_request_category_aliases.sql",
    import.meta.url,
  ),
  "utf8",
);
const cityAutocomplete = await readFile(
  new URL("../components/inputs/CityAutocomplete.tsx", import.meta.url),
  "utf8",
);
const micaChat = await readFile(
  new URL("../screens/MicaChat.tsx", import.meta.url),
  "utf8",
);
const confirmedLocationMigration = await readFile(
  new URL(
    "../supabase/migrations/20260917142144_require_confirmed_request_location_and_rank_city.sql",
    import.meta.url,
  ),
  "utf8",
);
const micaWorkerPanel = await readFile(
  new URL("../components/serviciosYa/PedidosMicaSection.tsx", import.meta.url),
  "utf8",
);

test("las publicaciones manuales reutilizan nuevaOferta con un origen distinguible", () => {
  assert.match(migration, /create_manual_service_request/);
  assert.match(migration, /'manual_app'/);
  assert.match(migration, /insert into public\."nuevaOferta"/);
  assert.match(publicationScreen, /createManualServiceRequest/);
});

test("cada cliente solo lista y cancela publicaciones propias", () => {
  assert.match(migration, /o\.app_cliente_id = auth\.uid\(\)/);
  assert.match(
    migration,
    /where id::text = p_oferta_id and app_cliente_id = auth\.uid\(\)/,
  );
  assert.match(migration, /REQUEST_ALREADY_CONFIRMED/);
});

test("los prestadores reciben pedidos manuales y de MICA sin duplicarlos", () => {
  assert.match(migration, /in \('mica_app', 'manual_app'\)/);
  assert.match(workerHome, /getWorkerServiceRequests/);
  assert.match(workerHome, /new Map<string, WorkerOffer>/);
  assert.match(workerHome, /respondToMicaOrder/);
});

test("los pedidos funcionan en toda Argentina sin depender de tildes", () => {
  assert.match(
    argentinaLocationMigration,
    /create extension if not exists unaccent/,
  );
  assert.match(argentinaLocationMigration, /extensions\.unaccent/);
  assert.match(argentinaLocationMigration, /p_provincia/);
  assert.match(cityAutocomplete, /for \(let from = 0; ; from \+= pageSize\)/);
});

test("el RPC obtiene zona y oficios del prestador autenticado", () => {
  assert.match(workerScopeMigration, /u\.id = auth\.uid\(\)/);
  assert.match(workerScopeMigration, /lower\(u\.rol::text\) = 'worker'/);
  assert.match(workerScopeMigration, /caller_trades/);
  assert.match(workerScopeMigration, /trim\(c\.provincia\)/);
  assert.doesNotMatch(workerScopeMigration, /trim\(p_provincia\)/);
});

test("las publicaciones relacionan oficios equivalentes", () => {
  assert.match(categoryAliasMigration, /service_category_key/);
  assert.match(categoryAliasMigration, /like '%plom%'/);
  assert.match(
    categoryAliasMigration,
    /service_category_key\(o\.categoria\).*service_category_key\(ct\.trade\)/s,
  );
});

test("MICA muestra la ubicación y deja entrar a mis publicaciones", () => {
  assert.match(micaChat, /Cambiar ciudad del pedido/);
  assert.match(micaChat, /Ver mis publicaciones/);
  assert.match(
    micaChat,
    /navigation\.navigate\("PublicarNecesidad", \{ view: "history" \}\)/,
  );
  assert.match(micaChat, /Conversación de esta búsqueda/);
  assert.match(micaChat, /locationSource !== "ip"/);
});

test("el cliente tiene un historial visible y separado de una publicación nueva", () => {
  assert.match(publicationScreen, /Mis búsquedas/);
  assert.match(publicationScreen, /Todas tus búsquedas/);
  assert.match(publicationScreen, /Nueva publicación/);
  assert.match(publicationScreen, /Falta confirmar la ubicación/);
  assert.match(publicationScreen, /locationState\.source === "ip"/);
  assert.match(publicationScreen, /"finalizada"/);
  assert.doesNotMatch(publicationScreen, /disabled=\{cancelled\}/);
});

test("el backend rechaza pedidos móviles sin ciudad o provincia confirmadas", () => {
  assert.match(confirmedLocationMigration, /REQUEST_CITY_REQUIRED/);
  assert.match(confirmedLocationMigration, /REQUEST_PROVINCE_REQUIRED/);
  assert.match(confirmedLocationMigration, /private\.create_mica_app_request/);
  assert.match(
    confirmedLocationMigration,
    /private\.create_manual_service_request/,
  );
});

test("los prestadores ven primero pedidos de su ciudad sin perder alcance provincial", () => {
  assert.match(
    confirmedLocationMigration,
    /extensions\.unaccent\(lower\(coalesce\(o\.provincia, ''\)\)\)/,
  );
  assert.match(confirmedLocationMigration, /order by\s+case/s);
  assert.match(confirmedLocationMigration, /coalesce\(o\.ciudad, ''\)/);
  assert.match(
    confirmedLocationMigration,
    /private\.get_mica_app_requests_for_worker/,
  );
  assert.match(confirmedLocationMigration, /security invoker/);
});

test("un prestador sin ubicación recibe una acción clara y no un listado vacío", () => {
  assert.match(micaWorkerPanel, /missingWorkerLocation/);
  assert.match(micaWorkerPanel, /Completar ubicación/);
  assert.match(micaWorkerPanel, /navigation\.navigate\("Perfil"\)/);
  assert.match(micaWorkerPanel, /!ctx\.ciudad\?\.trim\(\)/);
  assert.match(micaWorkerPanel, /!ctx\.provincia\?\.trim\(\)/);
});

test("calcula el total comisionable para proyecto, hora y día", () => {
  assert.equal(calculateQuoteReferenceTotal("project", 25000, 99), 25000);
  assert.equal(calculateQuoteReferenceTotal("hour", 8000, 3.5), 28000);
  assert.equal(calculateQuoteReferenceTotal("day", 45000, 2), 90000);
  assert.deepEqual(
    buildQuotePricing({
      pricingMode: "hour",
      unitRate: 10000,
      estimatedUnits: 4,
      referenceType: "cap",
    }),
    {
      pricingMode: "hour",
      unitRate: 10000,
      estimatedUnits: 4,
      referenceType: "cap",
      amount: 40000,
    },
  );
});

test("el backend rechaza totales manipulados y guarda la base del 10%", () => {
  assert.match(pricingMigration, /CHAT_QUOTE_TOTAL_MISMATCH/);
  assert.match(
    pricingMigration,
    /pricing_mode in \('project', 'hour', 'day'\)/,
  );
  assert.match(paymentPreference, /Math\.abs\(amount - submittedAmount\)/);
  assert.match(
    paymentPreference,
    /reference_total_type: pricing\.referenceType/,
  );
});

test("la agenda se habilita después del pago y limita cada ronda a tres opciones", () => {
  assert.match(scheduleMigration, /status <> 'approved'/);
  assert.match(scheduleMigration, /v_count < 1 or v_count > 3/);
  assert.match(scheduleMigration, /INITIAL_SCHEDULE_PROVIDER_ONLY/);
  assert.match(scheduleMigration, /SCHEDULE_OTHER_PARTY_MUST_SELECT/);
  assert.match(schedulePanel, /choices\.length < 3/);
});

test("las reprogramaciones conservan rondas y requieren aceptación", () => {
  assert.match(scheduleMigration, /p_reason <> 'reschedule'/);
  assert.match(scheduleMigration, /schedule_round = v_proposal\.round/);
  assert.match(scheduleMigration, /schedule_status = 'scheduled'/);
  assert.match(scheduleMigration, /can_replace_expired/);
});

test("el panel global reúne acciones, agenda, cierres y reclamos de ambos roles", () => {
  assert.match(
    jobsMigration,
    /auth\.uid\(\) in \(payment\.payer_id, payment\.provider_id\)/,
  );
  assert.match(jobsMigration, /requires_action boolean/);
  assert.match(jobsMigration, /incident_case_number/);
  assert.match(jobsOverview, /Necesitan tu acción/);
  assert.match(jobsOverview, /Próximos trabajos/);
  assert.match(jobsOverview, /Reclamos/);
});

test("MICA completa el intake antes de derivar el reclamo", () => {
  for (const field of [
    "occurred",
    "contactAttempts",
    "impact",
    "evidence",
    "requestedResolution",
  ]) {
    assert.match(incidentIntakeMigration, new RegExp(field));
    assert.match(incidentIntakeModal, new RegExp(field));
  }
  assert.match(incidentIntakeMigration, /INCIDENT_INTAKE_INCOMPLETE/);
  assert.match(incidentIntakeMigration, /'escalated'/);
  assert.match(incidentIntakeModal, /Confirmar y derivar/);
});
