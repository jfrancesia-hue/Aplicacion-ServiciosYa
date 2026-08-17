import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sameAmount(left: unknown, right: unknown) {
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.01;
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!supabaseUrl || !serviceRoleKey || !mercadoPagoToken) {
      return json({ ok: false, error: "Payment service not configured" }, 503);
    }

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const paymentId = String(
      url.searchParams.get("data.id") ??
        url.searchParams.get("id") ??
        body?.data?.id ??
        body?.id ??
        "",
    ).trim();

    const topic = String(
      url.searchParams.get("type") ??
        url.searchParams.get("topic") ??
        body?.type ??
        body?.topic ??
        "payment",
    ).toLowerCase();
    if (!/^\d{4,32}$/.test(paymentId) || !topic.includes("payment")) {
      return json({ ok: true, ignored: true });
    }

    const providerResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: `Bearer ${mercadoPagoToken}` },
      },
    );
    const providerPayment = await providerResponse.json();
    if (!providerResponse.ok) {
      return json({ ok: false, error: "Payment lookup failed" }, 502);
    }

    const paymentRecordId = String(
      providerPayment?.external_reference ??
        providerPayment?.metadata?.payment_record_id ??
        "",
    );
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentRecordId)) {
      return json({ ok: true, ignored: true });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: paymentRecord, error: recordError } = await admin
      .from("service_confirmation_payments")
      .select(
        "id,chat_id,chat_quote_id,payer_id,provider_id,commission_amount,currency,status,confirmation_message_id,cancellation_request_id",
      )
      .eq("id", paymentRecordId)
      .maybeSingle();
    if (recordError) throw recordError;
    if (!paymentRecord) return json({ ok: true, ignored: true });
    const providerStatus = String(providerPayment?.status ?? "pending");
    const validPayment =
      String(providerPayment?.external_reference ?? "") === paymentRecord.id &&
      String(providerPayment?.currency_id ?? "") === paymentRecord.currency &&
      sameAmount(
        providerPayment?.transaction_amount,
        paymentRecord.commission_amount,
      );

    if (!validPayment) {
      await admin
        .from("service_confirmation_payments")
        .update({
          status: "rejected",
          payment_id: paymentId,
          provider_status: "validation_mismatch",
        })
        .eq("id", paymentRecord.id)
        .in("status", ["creating", "pending", "error", "rejected"]);
      return json({ ok: false, error: "Payment validation mismatch" }, 409);
    }

    if (providerStatus === "refunded") {
      const refunds = Array.isArray(providerPayment?.refunds)
        ? providerPayment.refunds
        : [];
      const refundAmount =
        refunds.length > 0
          ? refunds.reduce(
              (total: number, refund: Record<string, unknown>) =>
                total + Number(refund?.amount ?? 0),
              0,
            )
          : Number(providerPayment?.transaction_amount ?? 0);
      const latestRefund =
        refunds.length > 0 ? refunds[refunds.length - 1] : null;
      const { data: reconciled, error: reconcileError } = await admin.rpc(
        "reconcile_service_reservation_refund",
        {
          p_payment_record_id: paymentRecord.id,
          p_request_id: paymentRecord.cancellation_request_id,
          p_payment_id: paymentId,
          p_refund_id: String(latestRefund?.id ?? ""),
          p_refund_amount: refundAmount,
          p_provider_status: providerStatus,
        },
      );
      if (reconcileError || !reconciled?.refunded) {
        throw reconcileError ?? new Error("Refund reconciliation failed");
      }
      return json({ ok: true, refunded: true, status: "refunded" });
    }

    if (
      providerStatus === "approved" &&
      paymentRecord.status === "approved" &&
      paymentRecord.confirmation_message_id
    ) {
      return json({ ok: true, approved: true, status: "approved" });
    }

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
        .eq("id", paymentRecord.id)
        .in("status", ["creating", "pending", "error", "rejected", "cancelled"]);
      return json({ ok: true, approved: false, status: localStatus });
    }

    const { data: confirmation, error: confirmationError } = await admin.rpc(
      "confirm_service_reservation",
      {
        p_payment_record_id: paymentRecord.id,
        p_payment_id: paymentId,
        p_provider_status: providerStatus,
      },
    );
    if (confirmationError || !confirmation?.approved) {
      throw confirmationError ?? new Error("Payment confirmation failed");
    }

    return json({ ok: true, approved: true });
  } catch (error) {
    console.error("[mercadopago-webhook]", error);
    return json({ ok: false, error: "Webhook processing failed" }, 500);
  }
});
