import { createClient } from "npm:@supabase/supabase-js@2";

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

function latestRefund(providerPayment: Record<string, unknown>) {
  const refunds = Array.isArray(providerPayment.refunds)
    ? providerPayment.refunds
    : [];
  return refunds.length > 0
    ? (refunds[refunds.length - 1] as Record<string, unknown>)
    : null;
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
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "El servicio de cancelaciones no está configurado." }, 503);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
    } = await admin.auth.getUser(bearerToken(req));
    if (!user) return json({ error: "Sesión requerida." }, 401);

    const body = await req.json().catch(() => ({}));
    const paymentRecordId = body?.paymentRecordId;
    const reasonCode = String(body?.reasonCode ?? "").trim();
    const reasonDetail = String(body?.reasonDetail ?? "").trim();
    if (!isUuid(paymentRecordId)) {
      return json({ error: "No se pudo identificar la reserva." }, 400);
    }
    if (
      ![
        "client_changed_mind",
        "provider_cancelled",
        "provider_no_show",
        "scheduling_issue",
        "other",
      ].includes(reasonCode)
    ) {
      return json({ error: "Elegí un motivo de cancelación válido." }, 400);
    }
    if (reasonDetail.length > 800) {
      return json({ error: "El detalle de cancelación es demasiado largo." }, 400);
    }

    const { data: cancellation, error: cancellationError } = await admin.rpc(
      "request_service_cancellation_internal",
      {
        p_payment_record_id: paymentRecordId,
        p_requester_id: user.id,
        p_reason_code: reasonCode,
        p_reason_detail: reasonDetail || null,
      },
    );
    if (cancellationError || !cancellation?.ok) {
      throw cancellationError ?? new Error("No se pudo registrar la cancelación.");
    }

    if (cancellation.action === "refunded") {
      return json({
        ok: true,
        refunded: true,
        status: "refunded",
        requestCode: cancellation.request_code,
      });
    }
    if (cancellation.action !== "refund") {
      return json({
        ok: true,
        refunded: false,
        reviewRequired: true,
        status: cancellation.status,
        requestCode: cancellation.request_code,
      });
    }

    const paymentId = String(cancellation.payment_id ?? "").trim();
    const refundAmount = Number(cancellation.refund_amount);
    if (!mercadoPagoToken) {
      await admin.rpc("fail_service_reservation_refund", {
        p_request_id: cancellation.request_id,
        p_error_message: "Mercado Pago no está configurado para devolver el cargo.",
        p_provider_status: "refund_not_configured",
      });
      return json({
        ok: false,
        refunded: false,
        reviewRequired: true,
        status: "refund_failed",
        requestCode: cancellation.request_code,
        message: "La devolución quedó registrada para revisión.",
      });
    }
    if (!/^\d{4,32}$/.test(paymentId) || !Number.isFinite(refundAmount)) {
      await admin.rpc("fail_service_reservation_refund", {
        p_request_id: cancellation.request_id,
        p_error_message: "La reserva no tiene un pago verificable para devolver.",
        p_provider_status: "missing_payment_data",
      });
      return json({
        ok: false,
        refunded: false,
        reviewRequired: true,
        status: "refund_failed",
        requestCode: cancellation.request_code,
        message: "La devolución quedó registrada para revisión.",
      });
    }

    let refundResponse: Response;
    try {
      refundResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mercadoPagoToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": cancellation.request_id,
          },
          body: "{}",
        },
      );
    } catch {
      await admin.rpc("fail_service_reservation_refund", {
        p_request_id: cancellation.request_id,
        p_error_message: "No se pudo conectar con Mercado Pago.",
        p_provider_status: "refund_network_error",
      });
      return json({
        ok: false,
        refunded: false,
        reviewRequired: true,
        status: "refund_failed",
        requestCode: cancellation.request_code,
        message: "La devolución quedó registrada para revisión.",
      });
    }
    let providerRefund = await refundResponse.json().catch(() => ({}));

    if (!refundResponse.ok) {
      let paymentResponse: Response;
      try {
        paymentResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
          { headers: { Authorization: `Bearer ${mercadoPagoToken}` } },
        );
      } catch {
        await admin.rpc("fail_service_reservation_refund", {
          p_request_id: cancellation.request_id,
          p_error_message: "No se pudo verificar el estado del reintegro.",
          p_provider_status: "refund_lookup_error",
        });
        return json({
          ok: false,
          refunded: false,
          reviewRequired: true,
          status: "refund_failed",
          requestCode: cancellation.request_code,
          message: "La devolución quedó registrada para revisión.",
        });
      }
      const providerPayment = await paymentResponse.json().catch(() => ({}));
      if (paymentResponse.ok && providerPayment?.status === "refunded") {
        providerRefund = latestRefund(providerPayment) ?? {
          id: providerPayment?.id,
          amount: providerPayment?.transaction_amount,
        };
      } else {
        await admin.rpc("fail_service_reservation_refund", {
          p_request_id: cancellation.request_id,
          p_error_message: String(
            providerRefund?.message ?? "Mercado Pago rechazó la devolución.",
          ),
          p_provider_status: String(
            providerRefund?.error ?? providerRefund?.status ?? "refund_error",
          ),
        });
        return json({
          ok: false,
          refunded: false,
          reviewRequired: true,
          status: "refund_failed",
          requestCode: cancellation.request_code,
          message:
            "Mercado Pago no completó la devolución automática. El caso quedó registrado para revisión.",
        });
      }
    }

    const providerRefundAmount = Number(providerRefund?.amount ?? refundAmount);
    if (!sameAmount(providerRefundAmount, refundAmount)) {
      await admin.rpc("fail_service_reservation_refund", {
        p_request_id: cancellation.request_id,
        p_error_message: "El monto devuelto no coincide con el cargo de reserva.",
        p_provider_status: "refund_amount_mismatch",
      });
      return json({
        ok: false,
        refunded: false,
        reviewRequired: true,
        status: "refund_failed",
        requestCode: cancellation.request_code,
        message: "La devolución requiere revisión manual.",
      });
    }

    const { data: reconciled, error: reconcileError } = await admin.rpc(
      "reconcile_service_reservation_refund",
      {
        p_payment_record_id: paymentRecordId,
        p_request_id: cancellation.request_id,
        p_payment_id: paymentId,
        p_refund_id: String(providerRefund?.id ?? ""),
        p_refund_amount: providerRefundAmount,
        p_provider_status: String(providerRefund?.status ?? "refunded"),
      },
    );
    if (reconcileError || !reconciled?.refunded) {
      await admin.rpc("fail_service_reservation_refund", {
        p_request_id: cancellation.request_id,
        p_error_message:
          reconcileError?.message ?? "No se pudo conciliar la devolución.",
        p_provider_status: "refund_reconciliation_error",
      });
      throw reconcileError ?? new Error("No se pudo conciliar la devolución.");
    }

    return json({
      ok: true,
      refunded: true,
      status: "refunded",
      requestCode: reconciled.request_code ?? cancellation.request_code,
      refundAmount: reconciled.refund_amount,
    });
  } catch (error) {
    console.error("[request-reservation-cancellation]", error);
    const message = error instanceof Error ? error.message : "";
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return json(
      {
        error:
          message.includes("RESERVATION_NOT_CANCELLABLE")
            ? "La reserva ya no se puede cancelar automáticamente."
            : message.includes("CANCELLATION_ALREADY_REQUESTED")
              ? "Ya existe una solicitud de cancelación para esta reserva."
              : "No se pudo procesar la cancelación.",
      },
      status,
    );
  }
});
