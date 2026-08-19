import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  formatLocationScope,
  providerMatchesLocation,
  resolveArgentineProvince,
  sameProvince,
} from "../lib/utils/geoSegmentation.ts";
import {
  createAudioMessageContent,
  getChatMessagePreview,
  parseAudioMessageContent,
} from "../lib/utils/audioMessage.ts";
import {
  createMicaAssistantContent,
  getMicaSystemMessagePreview,
  parseMicaSystemMessage,
} from "../lib/utils/micaMessage.ts";
import {
  asksForKnownLocation,
  inferMicaLocation,
} from "../lib/utils/micaLocation.ts";
import {
  SERVICE_CONFIRMATION_COMMISSION_RATE,
  calculateServiceConfirmationFee,
} from "../lib/constants/billing.ts";
import {
  createQuoteMessage,
  parseQuoteMessage,
} from "../lib/utils/quoteMessage.ts";
import {
  createServiceSystemContent,
  getServiceSystemMessagePreview,
  parseServiceSystemMessage,
} from "../lib/utils/serviceSystemMessage.ts";

test("segmenta prestadores de Catamarca sin depender de tildes", () => {
  const target = {
    ciudad: "San Fernando del Valle de Catamarca",
    provincia: "Catamarca",
  };

  assert.equal(
    providerMatchesLocation(
      { ciudad: "Valle Viejo", provincia: "Catamarca" },
      target,
    ),
    true,
  );
  assert.equal(
    providerMatchesLocation(
      { ciudad: "La Rioja", provincia: "La Rioja" },
      target,
    ),
    false,
  );
});
test("no mezcla CABA con provincia de Buenos Aires", () => {
  assert.equal(
    resolveArgentineProvince("Ciudad Autónoma de Buenos Aires"),
    "Ciudad Autónoma de Buenos Aires",
  );
  assert.equal(sameProvince("CABA", "Provincia de Buenos Aires"), false);
});

test("mantiene resultados cuando todavía no existe una ubicación", () => {
  assert.equal(
    providerMatchesLocation({ provincia: "Catamarca" }, null),
    true,
  );
  assert.equal(
    formatLocationScope({
      ciudad: "San Fernando del Valle de Catamarca",
      provincia: "Catamarca",
    }),
    "Catamarca",
  );
});

test("serializa audios y conserva la transcripción corregida", () => {
  const content = createAudioMessageContent({
    path: "chat/user/audio.m4a",
    durationMs: 12_400,
    mimeType: "audio/mp4",
    transcript: "Voy mañana a las nueve.",
  });
  const audio = parseAudioMessageContent(content);

  assert.equal(audio?.durationMs, 12_400);
  assert.equal(audio?.transcript, "Voy mañana a las nueve.");
  assert.equal(
    getChatMessagePreview(content),
    "🎤 Voy mañana a las nueve.",
  );
});

test("identifica de forma segura los mensajes compartidos por MICA", () => {
  const content = createMicaAssistantContent(
    "Acordado: visita mañana. Pendiente: confirmar materiales.",
    "user-id",
  );
  const message = parseMicaSystemMessage(content);

  assert.equal(message?.kind, "assistant");
  assert.equal(message?.requestedBy, "user-id");
  assert.match(getMicaSystemMessagePreview(content) ?? "", /^MICA:/);
});

test("calcula una reserva del 10% sin retener el precio del trabajo", () => {
  assert.equal(SERVICE_CONFIRMATION_COMMISSION_RATE, 0.1);
  assert.equal(calculateServiceConfirmationFee(100_000), 10_000);
});

test("serializa una propuesta con el desglose autoritativo", () => {
  const content = createQuoteMessage({
    quoteId: "quote-id",
    version: 2,
    amount: 100_000,
    feeRate: 0.1,
    feeAmount: 10_000,
    clientTotal: 110_000,
    scope: "Reparación e instalación",
    materials: "A confirmar",
    timeframe: "48 horas",
    warranty: "30 días",
    validUntil: "24 horas",
  });
  const quote = parseQuoteMessage(content);

  assert.equal(quote?.version, 2);
  assert.equal(quote?.amount, 100_000);
  assert.equal(quote?.feeAmount, 10_000);
  assert.equal(quote?.clientTotal, 110_000);
});

test("los estados de reserva no se presentan como mensajes de MICA", () => {
  const content = createServiceSystemContent({
    kind: "booking_confirmed",
    title: "Reserva confirmada",
    text: "El cargo de reserva fue aprobado.",
    actorId: "client-id",
  });
  const message = parseServiceSystemMessage(content);

  assert.equal(message?.kind, "booking_confirmed");
  assert.match(getServiceSystemMessagePreview(content) ?? "", /^ServiciosYa:/);
  assert.equal(parseMicaSystemMessage(content), null);
});

test("interpreta una resolución de cancelación como evento del servicio", () => {
  const content = createServiceSystemContent({
    kind: "cancellation_rejected",
    title: "Solicitud revisada",
    text: "La reserva continúa activa.",
    eventId: "request-id",
  });
  const message = parseServiceSystemMessage(content);

  assert.equal(message?.kind, "cancellation_rejected");
  assert.equal(message?.eventId, "request-id");
  assert.equal(parseMicaSystemMessage(content), null);
});

test("MICA reconoce ciudades y barrios con tildes sin repetir la pregunta", () => {
  assert.equal(inferMicaLocation("Zona Nueva Córdoba"), "Nueva Córdoba");
  assert.equal(
    inferMicaLocation("San Fernando del Valle de Catamarca", true),
    "San Fernando del Valle de Catamarca",
  );
  assert.equal(
    asksForKnownLocation(
      "¿En qué ciudad o barrio hay que hacer el trabajo?",
      "Nueva Córdoba",
    ),
    true,
  );
});

test("MICA conserva un fallback remoto cuando no hay proveedor de IA", () => {
  const functionSource = fs.readFileSync(
    "supabase/functions/mica-chat/index.ts",
    "utf8",
  );

  assert.match(functionSource, /buildLocalFallbackResponse/);
  assert.match(functionSource, /if \(!apiKey\)/);
  assert.match(functionSource, /knownLocation/);
  assert.doesNotMatch(functionSource, /OPENAI_API_KEY is not configured/);
});
