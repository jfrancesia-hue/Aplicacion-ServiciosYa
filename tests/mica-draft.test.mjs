import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  micaDraftKey,
  sanitizeMicaDraft,
} from "../lib/utils/micaDraft.ts";
import { buildApproximateCityLocation } from "../lib/utils/manualLocation.ts";

const NOW = Date.parse("2026-09-28T12:00:00.000Z");

test("MICA scopes drafts by account and flow", () => {
  assert.notEqual(
    micaDraftKey("client-a", "buscar-servicio"),
    micaDraftKey("client-b", "buscar-servicio"),
  );
  assert.notEqual(
    micaDraftKey("worker-a", "buscar-servicio"),
    micaDraftKey("worker-a", "ofrecer-servicio"),
  );
});

test("MICA keeps a recent conversation but removes transient thinking rows", () => {
  const draft = sanitizeMicaDraft(
    {
      version: 1,
      savedAt: "2026-09-28T11:59:00.000Z",
      messages: [
        { id: "intro", author: "mica", text: "Hola" },
        { id: "user-1", author: "user", text: "Necesito un plomero" },
        {
          id: "mica-thinking-1",
          author: "mica",
          text: "Estoy pensando",
        },
      ],
      insight: { service: "Plomería", location: "Catamarca" },
    },
    NOW,
  );

  assert.ok(draft);
  assert.deepEqual(
    draft.messages.map((message) => message.id),
    ["intro", "user-1"],
  );
  assert.equal(draft.insight.location, "Catamarca");
});

test("MICA expires abandoned drafts and ignores an empty greeting", () => {
  assert.equal(
    sanitizeMicaDraft(
      {
        savedAt: "2026-09-01T00:00:00.000Z",
        messages: [{ id: "intro", author: "mica", text: "Hola" }],
        insight: {},
      },
      NOW,
    ),
    null,
  );

  assert.equal(
    sanitizeMicaDraft(
      {
        savedAt: "2026-09-28T11:59:00.000Z",
        messages: [{ id: "intro", author: "mica", text: "Hola" }],
        insight: {},
      },
      NOW,
    ),
    null,
  );
});

test("provider flow cannot claim publication before the real form submit", async () => {
  const [screen, edgeFunction] = await Promise.all([
    readFile(new URL("../screens/MicaChat.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../supabase/functions/mica-chat/index.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(screen, /Continuar al formulario/);
  assert.doesNotMatch(screen, /label:\s*"Publicar mi servicio"/);
  assert.match(edgeFunction, /Nunca afirmes que quedo registrado/);
  assert.match(edgeFunction, /todavía no está publicado ni guardado/);
});

test("manual location can fall back to any Argentine city without blocking publication", () => {
  assert.deepEqual(
    buildApproximateCityLocation(
      {
        name: "San Fernando del Valle de Catamarca",
        latitude: -28.4696,
        longitude: -65.7852,
        country_code: "AR",
      },
      "Rivadavia 500",
    ),
    {
      name: "Rivadavia 500, San Fernando del Valle de Catamarca (zona aproximada)",
      lat: -28.4696,
      lng: -65.7852,
      isoCountryCode: "AR",
    },
  );
});

test("the chat list cannot stay blank forever or reuse another account cache", async () => {
  const [querySource, screenSource] = await Promise.all([
    readFile(new URL("../lib/utils/chat.ts", import.meta.url), "utf8"),
    readFile(new URL("../screens/ChatListScreen.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(querySource, /queryKey:\s*\["user", userId, "chats"\]/);
  assert.match(querySource, /10_000/);
  assert.match(screenSource, /styles\.emptyListContent/);
  assert.match(screenSource, /Todavía no tenés conversaciones/);
});
