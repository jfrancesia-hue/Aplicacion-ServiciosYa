import { createClient } from "npm:@supabase/supabase-js@2";

const QUOTE_PREFIX = "__TOORI_QUOTE__";
const COMMISSION_RATE = 0.1;
const MIN_QUOTE_ARS = 100;
const MAX_QUOTE_ARS = 100_000_000;
const OPERATIONAL_NOTICE_VERSION = "quote-operation-v1-2026-08-12";

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

function quotePricing(content: unknown) {
  const invalid = {
    amount: 0,
    pricingMode: "project",
    unitRate: 0,
    estimatedUnits: 1,
    referenceType: "fixed",
  };
  if (typeof content !== "string") return invalid;

  if (content.startsWith(QUOTE_PREFIX)) {
    try {
      const parsed = JSON.parse(content.slice(QUOTE_PREFIX.length));
      const pricingMode = ["project", "hour", "day"].includes(
        String(parsed?.pricingMode),
      )
        ? String(parsed.pricingMode)
        : "project";
      const unitRate = Number(parsed?.unitRate ?? parsed?.amount ?? 0);
      const estimatedUnits =
        pricingMode === "project" ? 1 : Number(parsed?.estimatedUnits ?? 0);
      const referenceType =
        pricingMode === "project"
          ? "fixed"
          : String(parsed?.referenceType) === "cap"
            ? "cap"
            : "estimate";
      const amount = Math.round(unitRate * estimatedUnits * 100) / 100;
      const submittedAmount = Number(parsed?.amount ?? 0);
      if (
        !Number.isFinite(amount) ||
        !Number.isFinite(unitRate) ||
        !Number.isFinite(estimatedUnits) ||
        unitRate <= 0 ||
        estimatedUnits <= 0 ||
        Math.abs(amount - submittedAmount) >= 0.01
      ) {
        return invalid;
      }
      return { amount, pricingMode, unitRate, estimatedUnits, referenceType };
    } catch {
      return invalid;
    }
  }

  if (content.startsWith("💰 Presupuesto:")) {
    const match = content.match(/\$([\d.,]+)/);
    const amount = match
      ? Number.parseFloat(match[1].replace(/\./g, "").replace(",", "."))
      : 0;
    return {
      amount,
      pricingMode: "project",
      unitRate: amount,
      estimatedUnits: 1,
      referenceType: "fixed",
    };
  }

  return invalid;
}

function quoteAmount(content: unknown) {
  return quotePricing(content).amount;
}

function commissionFor(amount: number) {
  return Math.round(amount * COMMISSION_RATE * 100) / 100;
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
    const chatId = body?.chatId;
    const messageId = body?.messageId;
    const noticeVersion = body?.operationalNotice?.version;
    const noticeAcceptedAt = body?.operationalNotice?.acceptedAt;
    if (!isUuid(chatId) || !isUuid(messageId)) {
      return json({ error: "No se pudo identificar el presupuesto." }, 400);
    }
    const noticeProvided = noticeVersion != null || noticeAcceptedAt != null;
    const noticeDate = noticeProvided
      ? new Date(String(noticeAcceptedAt ?? ""))
      : null;
    if (
      noticeProvided &&
      (noticeVersion !== OPERATIONAL_NOTICE_VERSION ||
        !noticeDate ||
        !Number.isFinite(noticeDate.getTime()) ||
        Math.abs(Date.now() - noticeDate.getTime()) > 30 * 60 * 1000)
    ) {
      return json(
        { error: "Revisá y confirmá el resumen operativo antes de continuar." },
        400,
      );
    }

    const { data: chat, error: chatError } = await admin
      .from("chats")
      .select("id,participant_a,participant_b")
      .eq("id", chatId)
      .maybeSingle();
    if (chatError) throw chatError;
    if (!chat) return json({ error: "Chat no encontrado." }, 404);

    const participants = new Set(
      [chat.participant_a, chat.participant_b].filter(Boolean),
    );
    if (!participants.has(user.id)) {
      return json({ error: "No pertenecés a este chat." }, 403);
    }

    const { data: message, error: messageError } = await admin
      .from("mensajes")
      .select("id,chat_id,contenido,remitente_id")
      .eq("id", messageId)
      .eq("chat_id", chatId)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!message) return json({ error: "Presupuesto no encontrado." }, 404);
    if (!message.remitente_id || message.remitente_id === user.id) {
      return json(
        { error: "Solo el cliente puede confirmar el presupuesto recibido." },
        403,
      );
    }
    if (!participants.has(message.remitente_id)) {
      return json({ error: "El presupuesto no pertenece a este chat." }, 409);
    }

    const pricing = quotePricing(message.contenido);
    const amountTotal = quoteAmount(message.contenido);
    if (
      !Number.isFinite(amountTotal) ||
      amountTotal < MIN_QUOTE_ARS ||
      amountTotal > MAX_QUOTE_ARS
    ) {
      return json({ error: "El monto del presupuesto no es válido." }, 400);
    }
    const commissionAmount = commissionFor(amountTotal);

    const { data: existing, error: existingError } = await admin
      .from("service_confirmation_payments")
      .select("id,status,checkout_url,preference_id")
      .eq("payer_id", user.id)
      .eq("quote_message_id", messageId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing && noticeDate) {
      const { error: noticeError } = await admin
        .from("service_confirmation_payments")
        .update({
          operational_notice_version: OPERATIONAL_NOTICE_VERSION,
          operational_notice_accepted_at: noticeDate.toISOString(),
        })
        .eq("id", existing.id);
      if (noticeError) throw noticeError;
    }
    if (existing?.status === "approved") {
      return json({ ok: true, approved: true, paymentRecordId: existing.id });
    }
    if (existing?.checkout_url) {
      return json({
        ok: true,
        approved: false,
        initPoint: existing.checkout_url,
        paymentRecordId: existing.id,
        preferenceId: existing.preference_id,
      });
    }

    const paymentRecord =
      existing ??
      (
        await admin
          .from("service_confirmation_payments")
          .insert({
            chat_id: chatId,
            quote_message_id: messageId,
            payer_id: user.id,
            provider_id: message.remitente_id,
            amount_total: amountTotal,
            commission_amount: commissionAmount,
            pricing_mode: pricing.pricingMode,
            unit_rate: pricing.unitRate,
            estimated_units: pricing.estimatedUnits,
            reference_total_type: pricing.referenceType,
            operational_notice_version: noticeDate
              ? OPERATIONAL_NOTICE_VERSION
              : null,
            operational_notice_accepted_at: noticeDate?.toISOString() ?? null,
            status: "creating",
          })
          .select("id,status,checkout_url,preference_id")
          .single()
      ).data;
    if (!paymentRecord) {
      throw new Error("No se pudo registrar el intento de pago.");
    }

    const recordParam = encodeURIComponent(paymentRecord.id);
    const preferenceResponse = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mercadoPagoToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": paymentRecord.id,
        },
        body: JSON.stringify({
          items: [
            {
              id: `service-confirmation-${messageId}`,
              title: "Confirmación de presupuesto - ServiciosYa",
              description: "Comisión del 10% por confirmación dentro de la app",
              quantity: 1,
              unit_price: commissionAmount,
              currency_id: "ARS",
            },
          ],
          back_urls: {
            success: `solucionesya://presupuesto-confirmado?status=approved&payment_record_id=${recordParam}`,
            failure: `solucionesya://presupuesto-confirmado?status=failure&payment_record_id=${recordParam}`,
            pending: `solucionesya://presupuesto-confirmado?status=pending&payment_record_id=${recordParam}`,
          },
          auto_return: "approved",
          external_reference: paymentRecord.id,
          metadata: {
            payment_record_id: paymentRecord.id,
            chat_id: chatId,
            quote_message_id: messageId,
            payer_id: user.id,
            provider_id: message.remitente_id,
          },
        }),
      },
    );
    const preference = await preferenceResponse.json();
    if (!preferenceResponse.ok || !preference?.init_point || !preference?.id) {
      await admin
        .from("service_confirmation_payments")
        .update({
          status: "error",
          provider_status: String(preference?.message ?? "preference_error"),
        })
        .eq("id", paymentRecord.id);
      return json(
        {
          error:
            "Mercado Pago no pudo iniciar la operación. Intentá nuevamente.",
        },
        502,
      );
    }

    const { error: updateError } = await admin
      .from("service_confirmation_payments")
      .update({
        preference_id: String(preference.id),
        checkout_url: String(preference.init_point),
        status: "pending",
        provider_status: "preference_created",
      })
      .eq("id", paymentRecord.id);
    if (updateError) throw updateError;

    return json({
      ok: true,
      approved: false,
      initPoint: preference.init_point,
      paymentRecordId: paymentRecord.id,
      preferenceId: preference.id,
    });
  } catch (error) {
    console.error("[create-payment-preference]", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar el pago.",
      },
      500,
    );
  }
});
