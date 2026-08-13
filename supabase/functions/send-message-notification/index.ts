import { createClient } from "npm:@supabase/supabase-js@2";

interface MensajeRecord {
  id: string;
  chat_id: string;
  remitente_id: string;
  contenido: string;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: MensajeRecord;
  schema: "public";
  old_record: null | MensajeRecord;
}

const LEGACY_PROTOCOL_NAMESPACE = ["TOO", "RI"].join("");
const AUDIO_MESSAGE_PREFIX = `__${LEGACY_PROTOCOL_NAMESPACE}_AUDIO_V1__:`;
const MICA_MESSAGE_PREFIXES = [
  `__${LEGACY_PROTOCOL_NAMESPACE}_MICA_HANDOFF_V1__:`,
  `__${LEGACY_PROTOCOL_NAMESPACE}_MICA_ASSIST_V1__:`,
];

function getNotificationBody(content: string) {
  const micaPrefix = MICA_MESSAGE_PREFIXES.find((prefix) =>
    content?.startsWith(prefix),
  );
  if (micaPrefix) {
    try {
      const message = JSON.parse(content.slice(micaPrefix.length));
      const text =
        typeof message?.text === "string"
          ? message.text.replace(/\s+/g, " ").trim()
          : "";
      return text ? `MICA: ${text.slice(0, 140)}` : "MICA intervino en el chat";
    } catch {
      return "MICA intervino en el chat";
    }
  }

  if (!content?.startsWith(AUDIO_MESSAGE_PREFIX)) {
    return content || "Nuevo mensaje de trabajo.";
  }

  try {
    const audio = JSON.parse(content.slice(AUDIO_MESSAGE_PREFIX.length));
    const transcript =
      typeof audio?.transcript === "string"
        ? audio.transcript.replace(/\s+/g, " ").trim()
        : "";
    return transcript
      ? `🎤 ${transcript.slice(0, 140)}`
      : "🎤 Recibiste un mensaje de voz";
  } catch {
    return "🎤 Recibiste un mensaje de voz";
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey)
  throw new Error("Missing Supabase env vars");
const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();

    if (payload.type !== "INSERT" || payload.table !== "mensajes") {
      return new Response(
        JSON.stringify({ ok: false, reason: "ignored event" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const msg = payload.record;

    // Buscar el chat para saber los participantes
    const { data: chat, error: chatErr } = await supabase
      .from("chats")
      .select("participant_a, participant_b")
      .eq("id", msg.chat_id)
      .single();

    if (chatErr || !chat) {
      return new Response(
        JSON.stringify({
          ok: false,
          reason: "chat_not_found",
          err: chatErr?.message,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // El receptor es el participante distinto del remitente
    const receptorId =
      chat.participant_a === msg.remitente_id
        ? chat.participant_b
        : chat.participant_a;

    // expo_token del receptor + nombre del remitente en paralelo
    const [{ data: receptor }, { data: remitente }] = await Promise.all([
      supabase
        .from("usuarios")
        .select("expo_token")
        .eq("id", receptorId)
        .maybeSingle(),
      supabase
        .from("usuarios")
        .select("nombre")
        .eq("id", msg.remitente_id)
        .maybeSingle(),
    ]);

    if (!receptor?.expo_token) {
      return new Response(
        JSON.stringify({ ok: false, reason: "no_expo_token", receptorId }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const title = remitente?.nombre
      ? `Nuevo mensaje de ${remitente.nombre}`
      : "Nuevo mensaje en ServiciosYa";
    const notificationBody = getNotificationBody(msg.contenido);

    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}`,
      },
      body: JSON.stringify({
        to: receptor.expo_token,
        priority: "high",
        channelId: "default",
        sound: "default",
        title,
        body: notificationBody,
        data: {
          screen: "ChatIndividual",
          params: {
            chatId: msg.chat_id,
            usuarioId1: chat.participant_a,
            usuarioId2: chat.participant_b,
          },
        },
      }),
    }).then((r) => r.json());

    return new Response(JSON.stringify({ ok: true, expo: expoRes }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
});
