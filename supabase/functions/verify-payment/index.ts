import { createClient } from "npm:@supabase/supabase-js@2";

const LEGACY_PROTOCOL_NAMESPACE = ["TOO", "RI"].join("");
const MICA_ASSISTANT_PREFIX = `__${LEGACY_PROTOCOL_NAMESPACE}_MICA_ASSIST_V1__:`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bearerToken(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function sameAmount(left: unknown, right: unknown) {
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.01;
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
    const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!supabaseUrl || !serviceRoleKey || !mercadoPagoToken) {
      return json({ error: "El servicio de pagos no está configurado." }, 503);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = bearerToken(req);
    const {
      data: { user },
    } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Sesión requerida." }, 401);

    const body = await req.json().catch(() => ({}));
    const paymentRecordId = body?.paymentRecordId;
    const paymentId = String(body?.paymentId ?? "").trim();
    if (!isUuid(paymentRecordId) || !/^\d{4,32}$/.test(paymentId)) {
      return json({ error: "No se pudo identificar el pago." }, 400);
    }

    const { data: paymentRecord, error: recordError } = await admin
      .from("service_confirmation_payments")
      .select(
        "id,chat_id,quote_message_id,payer_id,provider_id,commission_amount,currency,status,confirmation_message_id",
      )
      .eq("id", paymentRecordId)
      .eq("payer_id", user.id)
      .maybeSingle();
    if (recordError) throw recordError;
    if (!paymentRecord) return json({ error: "Pago no encontrado." }, 404);
    if (
      paymentRecord.status === "approved" &&
      paymentRecord.confirmation_message_id
    ) {
      return json({ ok: true, approved: true, status: "approved" });
    }

    const providerResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: `Bearer ${mercadoPagoToken}` },
      },
    );
    const providerPayment = await providerResponse.json();
    if (!providerResponse.ok) {
      return json(
        { error: "Mercado Pago no pudo verificar la operación." },
        providerResponse.status === 404 ? 404 : 502,
      );
    }

    const externalReference = String(
      providerPayment?.external_reference ?? "",
    );
    const currency = String(providerPayment?.currency_id ?? "");
    if (
      externalReference !== paymentRecord.id ||
      currency !== paymentRecord.currency ||
      !sameAmount(
        providerPayment?.transaction_amount,
        paymentRecord.commission_amount,
      )
    ) {
      await admin
        .from("service_confirmation_payments")
        .update({
          status: "rejected",
          payment_id: paymentId,
          provider_status: "validation_mismatch",
        })
        .eq("id", paymentRecord.id);
      return json({ error: "Los datos del pago no coinciden." }, 409);
    }

    const providerStatus = String(providerPayment?.status ?? "pending");
    if (providerStatus !== "approved") {
      const localStatus = ["rejected", "cancelled"].includes(providerStatus)
        ? providerStatus
        : "pending";
      await admin
        .from("service_confirmation_payments")
        .update({
          status: localStatus,
          payment_id: paymentId,
          provider_status: providerStatus,
        })
        .eq("id", paymentRecord.id);
      return json({
        ok: true,
        approved: false,
        status: localStatus,
        message:
          localStatus === "pending"
            ? "Mercado Pago todavía está procesando la operación."
            : "Mercado Pago no aprobó la operación.",
      });
    }

    const confirmationContent = `${MICA_ASSISTANT_PREFIX}${JSON.stringify({
      kind: "assistant",
      title: "Pago verificado por ServiciosYa",
      text: "La confirmación del presupuesto fue aprobada. Continúen coordinando fecha, alcance y condiciones dentro de este chat.",
      requestedBy: user.id,
    })}`;

    let confirmationMessageId = paymentRecord.confirmation_message_id;
    if (!confirmationMessageId) {
      const existingMessage = await admin
        .from("mensajes")
        .select("id")
        .eq("chat_id", paymentRecord.chat_id)
        .eq("contenido", confirmationContent)
        .limit(1)
        .maybeSingle();
      confirmationMessageId = existingMessage.data?.id ?? null;

      if (!confirmationMessageId) {
        const insertedMessage = await admin
          .from("mensajes")
          .insert({
            chat_id: paymentRecord.chat_id,
            remitente_id: user.id,
            contenido: confirmationContent,
          })
          .select("id")
          .single();
        if (insertedMessage.error || !insertedMessage.data) {
          throw (
            insertedMessage.error ??
            new Error("No se pudo registrar la confirmación.")
          );
        }
        confirmationMessageId = insertedMessage.data.id;
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("service_confirmation_payments")
      .update({
        status: "approved",
        job_status: "confirmed",
        schedule_status: "awaiting_provider_options",
        payment_id: paymentId,
        provider_status: providerStatus,
        approved_at: now,
        confirmation_message_id: confirmationMessageId,
      })
      .eq("id", paymentRecord.id);
    if (updateError) throw updateError;

    await admin
      .from("chats")
      .update({ acceso_contratado: true, updated_at: now })
      .eq("id", paymentRecord.chat_id);

    return json({ ok: true, approved: true, status: "approved" });
  } catch (error) {
    console.error("[verify-payment]", error);
    return json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo verificar el pago.",
      },
      500,
    );
  }
});
