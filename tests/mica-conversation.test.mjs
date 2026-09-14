import assert from "node:assert/strict";
import test from "node:test";
import { inferMicaSearchTiming } from "../lib/utils/micaConversation.ts";

test("las respuestas rápidas de urgencia hacen avanzar el pedido", () => {
  assert.deepEqual(inferMicaSearchTiming("Es urgente para hoy"), {
    urgency: "Alta",
    timeframe: "Hoy",
  });
  assert.deepEqual(inferMicaSearchTiming("Puede ser esta semana"), {
    urgency: "Flexible",
    timeframe: "Flexible",
  });
  assert.deepEqual(inferMicaSearchTiming("Quiero comparar precios"), {
    urgency: "Flexible",
    timeframe: "Flexible",
  });
});

test("un texto sin indicaciones temporales no inventa urgencia", () => {
  assert.deepEqual(inferMicaSearchTiming("Tengo una pérdida de agua"), {});
});
