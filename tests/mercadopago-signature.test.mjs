import assert from "node:assert/strict";
import test from "node:test";
import { verifyMercadoPagoSignature } from "../supabase/functions/_shared/mercadoPagoSignature.ts";

async function signature(secret, manifest) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(manifest),
  );
  return Buffer.from(digest).toString("hex");
}

test("valida la firma oficial de Mercado Pago y rechaza alteraciones", async () => {
  const secret = "secreto-de-prueba-no-productivo";
  const ts = 1_700_000_000;
  const paymentId = "123456789";
  const requestId = "request-123";
  const v1 = await signature(
    secret,
    `id:${paymentId};request-id:${requestId};ts:${ts};`,
  );

  assert.equal(
    await verifyMercadoPagoSignature({
      secret,
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestId,
      paymentId,
      nowSeconds: ts,
    }),
    true,
  );
  assert.equal(
    await verifyMercadoPagoSignature({
      secret,
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestId,
      paymentId: "999999999",
      nowSeconds: ts,
    }),
    false,
  );
});

test("rechaza firmas vencidas", async () => {
  assert.equal(
    await verifyMercadoPagoSignature({
      secret: "x",
      signatureHeader: "ts=1,v1=00",
      requestId: "request",
      paymentId: "1234",
      nowSeconds: 1_000,
    }),
    false,
  );
});
