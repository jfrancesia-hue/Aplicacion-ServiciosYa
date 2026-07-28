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

test("el cliente no contiene credenciales ni llama directo a Mercado Pago", () => {
  assert.equal(chatSource.includes(["APP", "USR"].join("_") + "-"), false);
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
