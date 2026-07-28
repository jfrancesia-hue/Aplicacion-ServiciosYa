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

test("el panel operativo exige rol administrador y no lee conversaciones", () => {
  assert.match(operationalDashboard, /profile\?\.rol === "admin"/);
  assert.doesNotMatch(
    operationalDashboard,
    /\.from\("mensajes"\)[\s\S]{0,160}\.select\("(contenido|\*)"\)/,
  );
});

test("las calificaciones requieren un pago aprobado y aplican RLS", () => {
  assert.match(
    operationalMigration,
    /v_payment\.status <> 'approved'/,
  );
  assert.match(
    operationalMigration,
    /alter table public\.service_job_reviews enable row level security/,
  );
  assert.match(
    chatSource,
    /submit_service_job_review/,
  );
});

test("la telemetría rechaza campos sensibles", () => {
  assert.match(operationalMigration, /'telefono'/);
  assert.match(operationalMigration, /'transcript'/);
  assert.match(operationalMigration, /SENSITIVE_EVENT_CONTEXT/);
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
