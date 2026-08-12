import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "chat-audios";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_MS = 120_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedMimeTypes: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/wav": "wav",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function isSafeChatPath(chatId: string, path: string) {
  return (
    path.startsWith(`${chatId}/`) &&
    !path.includes("..") &&
    !path.startsWith("/") &&
    path.length <= 500
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Supabase no está configurado." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = getBearerToken(req);
    if (!token) return json({ error: "Sesión requerida." }, 401);

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);
    if (userError || !user) return json({ error: "Sesión inválida." }, 401);

    const body = await req.json();
    const action = String(body?.action ?? "");
    const chatId = String(body?.chatId ?? "");
    if (!chatId) return json({ error: "Falta identificar el chat." }, 400);

    const { data: chat, error: chatError } = await admin
      .from("chats")
      .select("id, participant_a, participant_b")
      .eq("id", chatId)
      .maybeSingle();

    if (
      chatError ||
      !chat ||
      (chat.participant_a !== user.id && chat.participant_b !== user.id)
    ) {
      return json({ error: "No tenés acceso a este chat." }, 403);
    }

    if (action === "create-upload") {
      const mimeType = String(body?.mimeType ?? "").toLowerCase();
      const extension = allowedMimeTypes[mimeType];
      const durationMs = Number(body?.durationMs ?? 0);

      if (!extension) {
        return json({ error: "Formato de audio no permitido." }, 400);
      }
      if (
        !Number.isFinite(durationMs) ||
        durationMs < 700 ||
        durationMs > MAX_DURATION_MS
      ) {
        return json(
          { error: "El audio debe durar entre 1 segundo y 2 minutos." },
          400,
        );
      }

      const { data: existingBucket } = await admin.storage.getBucket(BUCKET);
      if (!existingBucket) {
        const { error: bucketError } = await admin.storage.createBucket(
          BUCKET,
          {
            public: false,
            fileSizeLimit: MAX_FILE_BYTES,
            allowedMimeTypes: Object.keys(allowedMimeTypes),
          },
        );
        if (
          bucketError &&
          !bucketError.message.toLowerCase().includes("already")
        ) {
          return json(
            { error: "No se pudo preparar el almacenamiento de audio." },
            500,
          );
        }
      }

      const path = `${chatId}/${user.id}/${crypto.randomUUID()}.${extension}`;
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path, { upsert: false });

      if (error || !data?.token) {
        return json(
          { error: error?.message ?? "No se pudo iniciar la carga." },
          500,
        );
      }

      return json({
        path,
        token: data.token,
        bucket: BUCKET,
        maxFileBytes: MAX_FILE_BYTES,
      });
    }

    const path = String(body?.path ?? "");
    if (!path || !isSafeChatPath(chatId, path)) {
      return json({ error: "Ruta de audio inválida." }, 400);
    }

    if (action === "discard") {
      if (!path.startsWith(`${chatId}/${user.id}/`)) {
        return json({ error: "Solo podés descartar tus propios audios." }, 403);
      }
      const { error } = await admin.storage.from(BUCKET).remove([path]);
      if (error) return json({ error: "No se pudo descartar el audio." }, 500);
      return json({ ok: true });
    }

    if (action === "signed-url") {
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60);

      if (error || !data?.signedUrl) {
        return json(
          { error: error?.message ?? "No se pudo abrir el audio." },
          404,
        );
      }

      return json({ signedUrl: data.signedUrl });
    }

    if (action === "transcribe") {
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) {
        return json({
          transcript: null,
          warning: "Transcripción no configurada.",
        });
      }

      const { data: audioBlob, error: downloadError } = await admin.storage
        .from(BUCKET)
        .download(path);

      if (downloadError || !audioBlob) {
        return json(
          { error: downloadError?.message ?? "No se encontró el audio." },
          404,
        );
      }
      if (audioBlob.size > MAX_FILE_BYTES) {
        return json(
          { error: "El archivo de audio supera el límite permitido." },
          413,
        );
      }

      const fileName = path.split("/").pop() || "mensaje.m4a";
      const form = new FormData();
      form.append("file", audioBlob, fileName);
      form.append(
        "model",
        Deno.env.get("OPENAI_TRANSCRIBE_MODEL") ?? "gpt-4o-mini-transcribe",
      );
      form.append("language", "es");
      form.append("response_format", "json");
      form.append(
        "prompt",
        "Conversación en español argentino sobre servicios, oficios, presupuestos, materiales, horarios y ubicaciones.",
      );

      const transcriptionResponse = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        },
      );
      const transcription = await transcriptionResponse.json();

      if (!transcriptionResponse.ok) {
        console.error(
          "[chat-audio] transcription failed",
          transcription?.error,
        );
        return json({
          transcript: null,
          warning: "El audio se guardó, pero no se pudo transcribir.",
        });
      }

      const transcript =
        typeof transcription?.text === "string"
          ? transcription.text.trim().slice(0, 4_000)
          : "";

      return json({ transcript: transcript || null });
    }

    return json({ error: "Acción no válida." }, 400);
  } catch (error) {
    console.error("[chat-audio]", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado.",
      },
      500,
    );
  }
});
