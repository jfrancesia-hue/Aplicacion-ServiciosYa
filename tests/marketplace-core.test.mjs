import assert from "node:assert/strict";
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
