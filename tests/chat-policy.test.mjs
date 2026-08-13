import assert from "node:assert/strict";
import test from "node:test";
import { inspectChatContent, inspectChatText } from "../lib/utils/chatPolicy.ts";
import { createQuoteMessage } from "../lib/utils/quoteMessage.ts";

test("permite horarios, fechas y direcciones sin confundirlos con teléfonos", () => {
  assert.equal(inspectChatText("Voy el 14/8 a las 18:30, altura 1250").allowed, true);
});

test("bloquea teléfonos, emails, enlaces y redes sociales", () => {
  for (const text of [
    "Mi número es 3834 555 222",
    "Escribime a persona@example.com",
    "Entrá a https://ejemplo.com",
    "Hablame por WhatsApp",
    "Mi Instagram es @servicio_cata",
  ]) {
    assert.deepEqual(inspectChatText(text).allowed, false, text);
  }
});

test("obliga a usar presupuesto para comunicar montos", () => {
  assert.equal(inspectChatText("Te sale $25000").allowed, false);
  assert.equal(inspectChatText("El precio es 25000 pesos").allowed, false);
  assert.equal(inspectChatText("Mandame un presupuesto, por favor").allowed, true);
  assert.equal(
    inspectChatText("¿El presupuesto incluye las 3 habitaciones?").allowed,
    true,
  );
});

test("admite presupuestos estructurados y rechaza contacto dentro de ellos", () => {
  const valid = createQuoteMessage({
    amount: 25_000,
    scope: "Reparación y prueba final",
    materials: "Incluidos",
    timeframe: "Mañana a las 10",
    warranty: "30 días",
    validUntil: "48 horas",
  });
  const invalid = createQuoteMessage({
    amount: 25_000,
    scope: "Reparación; llamame al 3834 555 222",
    materials: "Incluidos",
    timeframe: "Mañana",
    warranty: "30 días",
    validUntil: "48 horas",
  });

  assert.equal(inspectChatContent(valid).allowed, true);
  assert.equal(inspectChatContent(invalid).allowed, false);
});
