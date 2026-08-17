import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();

function textResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function toHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function verifyToken(token: string, secret: string) {
  const [payloadPart, signature] = token.split(".");
  if (!payloadPart || !signature) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = toHex(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payloadPart)),
  );
  if (!safeEqual(expected, signature)) return null;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payloadPart)),
    );
    if (
      typeof payload?.userId !== "string" ||
      typeof payload?.reminderId !== "string" ||
      Number(payload?.exp ?? 0) <= Date.now()
    ) {
      return null;
    }
    return payload as { userId: string; reminderId: string; exp: number };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const token = url.searchParams.get("token") ?? "";
  const secret = Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !supabaseUrl || !serviceRoleKey) {
    return textResponse(
      "La configuración de comunicaciones está incompleta.",
      503,
    );
  }

  const payload = await verifyToken(token, secret);
  if (!payload) {
    return textResponse("El enlace es inválido o ya venció.", 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "unsubscribe") {
    const { error } = await admin
      .from("provider_communication_preferences")
      .upsert(
        {
          user_id: payload.userId,
          marketing_email_enabled: false,
          unsubscribed_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) {
      return textResponse(
        "No pudimos registrar la baja. Intentá nuevamente.",
        500,
      );
    }
    return textResponse(
      "Listo. No vas a recibir más recordatorios promocionales de perfil de ServiciosYa.",
    );
  }

  if (action === "profile") {
    await admin
      .from("provider_profile_reminders")
      .update({
        status: "clicked",
        clicked_at: new Date().toISOString(),
      })
      .eq("id", payload.reminderId)
      .eq("user_id", payload.userId);

    const profileUrl =
      Deno.env.get("PROVIDER_PROFILE_URL") ?? "solucionesya://completar-perfil";
    return new Response(null, {
      status: 302,
      headers: {
        Location: profileUrl,
        "Cache-Control": "no-store",
      },
    });
  }

  return textResponse("Acción no permitida.", 400);
});
