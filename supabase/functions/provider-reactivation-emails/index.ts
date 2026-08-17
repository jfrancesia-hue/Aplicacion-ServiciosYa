import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const encoder = new TextEncoder();

type Candidate = {
  user_id: string;
  email: string;
  nombre: string;
  profile_score: number;
  missing_fields: string[];
  reminders_sent: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}

function bearerToken(req: Request) {
  return (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function toHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signedToken(userId: string, reminderId: string, secret: string) {
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({
        userId,
        reminderId,
        exp: Date.now() + 90 * 24 * 60 * 60 * 1000,
      }),
    ),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = toHex(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
  return `${payload}.${signature}`;
}

const FIELD_LABELS: Record<string, string> = {
  nombre: "tu nombre",
  celular: "tu celular",
  especialidad: "tus especialidades",
  provincia: "tu provincia",
  ciudad: "tu ciudad",
  foto: "una foto de perfil",
  descripcion: "una presentación profesional",
  experiencia: "tu experiencia",
  horarios: "tus horarios",
};

function missingCopy(fields: string[]) {
  const labels = fields
    .map((field) => FIELD_LABELS[field] ?? field)
    .slice(0, 4);
  if (labels.length === 0) return "algunos datos profesionales";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} y ${labels.at(-1)}`;
}

function emailHtml({
  candidate,
  profileLink,
  unsubscribeLink,
  legalAddress,
}: {
  candidate: Candidate;
  profileLink: string;
  unsubscribeLink: string;
  legalAddress: string;
}) {
  const name = escapeHtml(candidate.nombre || "prestador");
  const missing = escapeHtml(missingCopy(candidate.missing_fields));
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#edf4f2;font-family:Arial,sans-serif;color:#17373e">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf4f2;padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:22px;overflow:hidden">
          <tr><td style="padding:24px;background:#047a8f;color:#ffffff">
            <div style="font-size:12px;font-weight:700;letter-spacing:1px">SERVICIOSYA</div>
            <h1 style="font-size:25px;margin:8px 0 0">Tu perfil puede generar más confianza</h1>
          </td></tr>
          <tr><td style="padding:26px">
            <p style="font-size:16px;line-height:24px;margin:0 0 14px">Hola, ${name}.</p>
            <p style="font-size:15px;line-height:23px;margin:0 0 14px">
              Tu perfil está registrado, pero todavía podés agregar ${missing}.
              Un perfil claro ayuda a que los clientes sepan qué hacés y cuándo pueden contactarte.
            </p>
            <p style="font-size:15px;line-height:23px;margin:0 0 22px">
              <strong>Crear y completar tu perfil no tiene costo.</strong>
              No podemos garantizar una cantidad de consultas, pero sí ayudarte a mostrar mejor tu trabajo.
            </p>
            <p style="text-align:center;margin:0 0 24px">
              <a href="${escapeHtml(profileLink)}" style="display:inline-block;background:#069eb3;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:24px">
                Completar mi perfil gratis
              </a>
            </p>
            <p style="font-size:12px;line-height:18px;color:#688085;margin:0">
              Si el botón no abre la app, ingresá a ServiciosYa y elegí “Mi perfil”.
            </p>
          </td></tr>
          <tr><td style="padding:18px 26px;background:#f4f8f7;color:#75898d;font-size:11px;line-height:17px">
            PUBLICIDAD · ServiciosYa · ${escapeHtml(legalAddress)}<br>
            Recibís este mensaje porque tenés una cuenta o perfil de prestador asociado a ServiciosYa.
            <a href="${escapeHtml(unsubscribeLink)}" style="color:#047a8f">No recibir más recordatorios</a>.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Método no permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Configuración incompleta." }, 503);
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
    } = await admin.auth.getUser(bearerToken(req));
    if (!user) return json({ error: "Sesión requerida." }, 401);

    const { data: profile } = await admin
      .from("usuarios")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.rol !== "admin") {
      return json({ error: "Acceso exclusivo para administradores." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "status");
    const { count: dueCount, error: dueError } = await admin
      .from("provider_profile_completeness")
      .select("user_id", { count: "exact", head: true })
      .eq("email_due", true);
    if (dueError) throw dueError;

    const { count: incompleteCount, error: incompleteError } = await admin
      .from("provider_profile_completeness")
      .select("user_id", { count: "exact", head: true })
      .lt("profile_score", 100);
    if (incompleteError) throw incompleteError;

    if (action === "status") {
      const { data: recent, error: recentError } = await admin
        .from("provider_profile_reminders")
        .select("id,status,sent_at,created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (recentError) throw recentError;
      return json({
        ok: true,
        due: dueCount ?? 0,
        incomplete: incompleteCount ?? 0,
        recent: recent ?? [],
      });
    }
    if (action !== "send") {
      return json({ error: "Acción no permitida." }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("PROVIDER_EMAIL_FROM");
    const legalAddress = Deno.env.get("PROVIDER_EMAIL_LEGAL_ADDRESS");
    const unsubscribeSecret = Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET");
    if (!resendApiKey || !emailFrom || !legalAddress || !unsubscribeSecret) {
      return json(
        {
          error:
            "Faltan RESEND_API_KEY, PROVIDER_EMAIL_FROM, PROVIDER_EMAIL_LEGAL_ADDRESS o EMAIL_UNSUBSCRIBE_SECRET.",
        },
        503,
      );
    }

    const requestedBatch = Number(body?.batchSize ?? 10);
    const batchSize = Number.isFinite(requestedBatch)
      ? Math.min(25, Math.max(1, Math.round(requestedBatch)))
      : 10;
    const { data: rawCandidates, error: candidatesError } = await admin
      .from("provider_profile_completeness")
      .select(
        "user_id,email,nombre,profile_score,missing_fields,reminders_sent",
      )
      .eq("email_due", true)
      .order("last_reminder_at", { ascending: true, nullsFirst: true })
      .limit(batchSize);
    if (candidatesError) throw candidatesError;

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const functionBase = `${supabaseUrl}/functions/v1/provider-email-preferences`;

    for (const rawCandidate of rawCandidates ?? []) {
      const candidate = rawCandidate as Candidate;
      const reminderNumber = Number(candidate.reminders_sent ?? 0) + 1;
      const { data: authUser } = await admin.auth.admin.getUserById(
        candidate.user_id,
      );
      if (!authUser.user?.email_confirmed_at) {
        skipped += 1;
        continue;
      }

      const { data: reminder, error: reminderError } = await admin
        .from("provider_profile_reminders")
        .upsert(
          {
            user_id: candidate.user_id,
            reminder_number: reminderNumber,
            recipient_email: candidate.email,
            missing_fields: candidate.missing_fields,
            profile_score: candidate.profile_score,
            status: "preparing",
            error_message: null,
          },
          { onConflict: "user_id,reminder_number" },
        )
        .select("id")
        .single();
      if (reminderError || !reminder) {
        failed += 1;
        continue;
      }

      const token = await signedToken(
        candidate.user_id,
        reminder.id,
        unsubscribeSecret,
      );
      const profileLink = `${functionBase}?action=profile&token=${encodeURIComponent(token)}`;
      const unsubscribeLink = `${functionBase}?action=unsubscribe&token=${encodeURIComponent(token)}`;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `provider-profile/${candidate.user_id}/${reminderNumber}`,
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [candidate.email],
          subject: "PUBLICIDAD - Completá tu perfil gratis en ServiciosYa",
          html: emailHtml({
            candidate,
            profileLink,
            unsubscribeLink,
            legalAddress,
          }),
          headers: {
            "List-Unsubscribe": `<${unsubscribeLink}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          tags: [
            { name: "campaign", value: "provider-profile" },
            { name: "reminder", value: String(reminderNumber) },
          ],
        }),
      });
      const providerResult = await response.json().catch(() => ({}));
      if (!response.ok || !providerResult?.id) {
        failed += 1;
        await admin
          .from("provider_profile_reminders")
          .update({
            status: "failed",
            error_message: String(
              providerResult?.message ?? "Resend rechazó el email.",
            ).slice(0, 1000),
          })
          .eq("id", reminder.id);
        continue;
      }

      await admin
        .from("provider_profile_reminders")
        .update({
          status: "sent",
          provider_message_id: String(providerResult.id),
          sent_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", reminder.id);
      sent += 1;
    }

    return json({
      ok: true,
      processed: (rawCandidates ?? []).length,
      sent,
      skipped,
      failed,
      remainingDue: Math.max(0, Number(dueCount ?? 0) - sent),
    });
  } catch (error) {
    console.error("[provider-reactivation-emails]", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo procesar la campaña.",
      },
      500,
    );
  }
});
