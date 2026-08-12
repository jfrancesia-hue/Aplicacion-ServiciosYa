import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const emailFrom = Deno.env.get("TRANSACTIONAL_EMAIL_FROM");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type OutboxRow = {
  id: string;
  user_id: string;
  event_type: string;
  title: string;
  body: string;
  action_screen: string | null;
  action_params: Record<string, unknown>;
  in_app_status: "pending" | "sent" | "failed";
  push_status: "pending" | "sent" | "skipped" | "failed";
  email_status:
    | "pending"
    | "sent"
    | "skipped"
    | "waiting_configuration"
    | "failed";
  attempts: number;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendPush(
  token: string,
  row: OutboxRow,
) {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(expoAccessToken
        ? { Authorization: `Bearer ${expoAccessToken}` }
        : {}),
    },
    body: JSON.stringify({
      to: token,
      priority: "high",
      sound: "default",
      title: row.title,
      body: row.body,
      data: row.action_screen
        ? { screen: row.action_screen, params: row.action_params }
        : {},
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.data?.status === "error") {
    throw new Error(payload?.data?.message || `Expo push ${response.status}`);
  }
}

async function sendEmail(
  email: string,
  name: string | null,
  row: OutboxRow,
) {
  if (!resendApiKey || !emailFrom) throw new Error("EMAIL_NOT_CONFIGURED");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [email],
      subject: row.title,
      text: `${name ? `Hola ${name},\n\n` : ""}${row.body}\n\nAbrí Servicios Ya para ver los detalles.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17383f">
          <div style="background:#069eb3;color:white;padding:18px 22px;border-radius:14px 14px 0 0">
            <strong style="font-size:18px">Servicios Ya</strong>
          </div>
          <div style="border:1px solid #d8e7e9;border-top:0;padding:22px;border-radius:0 0 14px 14px">
            ${name ? `<p>Hola ${escapeHtml(name)},</p>` : ""}
            <h2 style="font-size:20px">${escapeHtml(row.title)}</h2>
            <p style="line-height:1.6">${escapeHtml(row.body)}</p>
            <p style="color:#61787d;font-size:13px">Abrí la app Servicios Ya para revisar los detalles y continuar dentro del canal protegido.</p>
          </div>
        </div>`,
      tags: [{ name: "event_type", value: row.event_type.replace(/[^a-zA-Z0-9_-]/g, "_") }],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Email provider ${response.status}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { data, error } = await admin.rpc(
      "claim_transactional_notifications",
      { p_limit: 50 },
    );
    if (error) throw error;

    const rows = (data ?? []) as OutboxRow[];
    const results: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      const attemptAt = new Date().toISOString();
      const { data: profile } = await admin
        .from("usuarios")
        .select("nombre,email,expo_token")
        .eq("id", row.user_id)
        .maybeSingle();

      const update: Record<string, unknown> = {
        processing_at: null,
        updated_at: attemptAt,
        last_error: null,
        next_attempt_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };
      const errors: string[] = [];

      if (row.in_app_status === "pending") {
        const inApp = await admin.from("notificaciones").upsert(
          {
            receptor_id: row.user_id,
            mensaje: row.body,
            estado: row.event_type,
            leido: false,
            transactional_outbox_id: row.id,
          },
          { onConflict: "transactional_outbox_id", ignoreDuplicates: true },
        );
        if (inApp.error) errors.push(`in_app:${inApp.error.message}`);
        else {
          update.in_app_status = "sent";
          update.in_app_sent_at = attemptAt;
        }
      }

      if (row.push_status === "pending") {
        if (!profile?.expo_token) update.push_status = "skipped";
        else {
          try {
            await sendPush(profile.expo_token, row);
            update.push_status = "sent";
            update.push_sent_at = attemptAt;
          } catch (pushError) {
            errors.push(
              `push:${pushError instanceof Error ? pushError.message : String(pushError)}`,
            );
          }
        }
      }

      if (["pending", "waiting_configuration"].includes(row.email_status)) {
        if (!profile?.email) update.email_status = "skipped";
        else if (!resendApiKey || !emailFrom) {
          update.email_status = "waiting_configuration";
          update.next_attempt_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          errors.push("email:EMAIL_NOT_CONFIGURED");
        } else {
          try {
            await sendEmail(profile.email, profile.nombre, row);
            update.email_status = "sent";
            update.email_sent_at = attemptAt;
          } catch (emailError) {
            errors.push(
              `email:${emailError instanceof Error ? emailError.message : String(emailError)}`,
            );
          }
        }
      }

      if (row.attempts >= 8) {
        if (!update.push_status && row.push_status === "pending") update.push_status = "failed";
        if (!update.email_status && row.email_status === "pending") update.email_status = "failed";
        if (!update.in_app_status && row.in_app_status === "pending") update.in_app_status = "failed";
      }
      update.last_error = errors.length > 0 ? errors.join(" | ").slice(0, 2000) : null;

      await admin
        .from("transactional_notification_outbox")
        .update(update)
        .eq("id", row.id);
      results.push({ id: row.id, errors });
    }

    return new Response(
      JSON.stringify({ ok: true, processed: rows.length, results }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[transactional-notifications]", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
