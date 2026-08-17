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
  return authorization.replace(/^Bearer\s+/i, "").trim();
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isExpoPushToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(value)
  );
}

async function sendPush(
  token: unknown,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  if (!isExpoPushToken(token)) {
    return { ok: false, skipped: true, status: "missing_token" };
  }

  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(expoAccessToken
        ? { Authorization: `Bearer ${expoAccessToken}` }
        : {}),
    },
    body: JSON.stringify({
      to: token,
      priority: "high",
      channelId: "urgent-work",
      sound: "urgent_work.wav",
      title,
      body,
      data,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  const ticket = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  return {
    ok: response.ok && ticket?.status !== "error",
    status: response.ok ? String(ticket?.status ?? "sent") : "failed",
    ticketId: String(ticket?.id ?? ""),
  };
}

function errorResponse(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const known: Array<[string, string, number]> = [
    [
      "URGENT_REQUEST_ALREADY_ACTIVE",
      "Ya tenés un pedido urgente activo. Podés seguirlo o cancelarlo.",
      409,
    ],
    [
      "URGENT_REQUEST_RATE_LIMIT",
      "Alcanzaste el límite diario de pedidos urgentes.",
      429,
    ],
    ["INVALID_URGENT_REQUEST", "Revisá los datos del pedido urgente.", 400],
    ["URGENT_REQUEST_EXPIRED", "El pedido urgente ya venció.", 409],
    ["URGENT_REQUEST_ALREADY_ANSWERED", "Ya respondiste este pedido.", 409],
    ["PROVIDER_NOT_INTERESTED", "El prestador ya no está disponible.", 409],
    ["CHAT_BLOCKED", "No se puede iniciar este chat.", 403],
  ];
  const match = known.find(([code]) => message.includes(code));
  return match
    ? json({ error: match[1], code: match[0] }, match[2])
    : json({ error: "No se pudo procesar el pedido urgente." }, 500);
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
      return json({ error: "Servicio urgente no configurado." }, 503);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
    } = await admin.auth.getUser(bearerToken(req));
    if (!user) return json({ error: "Sesión requerida." }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim();

    if (action === "create") {
      const { data, error } = await admin.rpc(
        "create_urgent_service_request_internal",
        {
          p_client_id: user.id,
          p_category: String(body?.category ?? "").trim(),
          p_description: String(body?.description ?? "").trim(),
          p_urgency_window: String(body?.urgencyWindow ?? "").trim(),
          p_city: String(body?.city ?? "").trim(),
          p_province: String(body?.province ?? "").trim(),
        },
      );
      if (error || !data?.ok) throw error ?? new Error("URGENT_CREATE_FAILED");

      const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
      await Promise.all(
        candidates.map(
          async (candidate: {
            candidate_id?: string;
            expo_token?: string;
          }) => {
            const delivery = await sendPush(
              candidate.expo_token,
              "Pedido urgente en tu zona",
              `${String(body?.category ?? "Servicio")} · ${String(
                body?.city ?? "",
              )} · Respondé si podés atenderlo.`,
              {
                type: "urgent_service_request",
                requestId: data.request_id,
                screen: "Home",
                params: { workerTab: "ofertas" },
              },
            ).catch(() => ({ ok: false, status: "failed", ticketId: "" }));

            if (isUuid(candidate.candidate_id)) {
              await admin
                .from("urgent_service_candidates")
                .update({
                  push_status: delivery.status,
                  push_ticket_id: delivery.ticketId || null,
                })
                .eq("id", candidate.candidate_id);
            }
          },
        ),
      );

      return json({
        ok: true,
        request: {
          id: data.request_id,
          requestCode: data.request_code,
          status: data.status,
          candidateCount: data.candidate_count,
          expiresAt: data.expires_at,
        },
      });
    }

    if (action === "provider-list") {
      const { data, error } = await admin.rpc(
        "get_provider_urgent_requests_internal",
        { p_provider_id: user.id },
      );
      if (error) throw error;
      return json({ ok: true, requests: data?.requests ?? [] });
    }

    if (action === "respond") {
      if (!isUuid(body?.requestId) || typeof body?.interested !== "boolean") {
        return json({ error: "Respuesta inválida." }, 400);
      }
      const { data, error } = await admin.rpc(
        "respond_urgent_service_request_internal",
        {
          p_provider_id: user.id,
          p_request_id: body.requestId,
          p_interested: body.interested,
        },
      );
      if (error || !data?.ok)
        throw error ?? new Error("URGENT_RESPONSE_FAILED");

      if (body.interested) {
        await sendPush(
          data.client_expo_token,
          "Un prestador respondió",
          `Hay una respuesta para tu pedido ${data.request_code}.`,
          {
            type: "urgent_provider_interested",
            requestId: body.requestId,
            screen: "ServiciosPorCategoria",
            params: { categoria: data.category },
          },
        ).catch(() => null);
      }

      return json({ ok: true, status: data.status });
    }

    if (action === "client-status") {
      if (body?.requestId != null && !isUuid(body.requestId)) {
        return json({ error: "Pedido inválido." }, 400);
      }
      const { data, error } = await admin.rpc(
        "get_client_urgent_request_internal",
        {
          p_client_id: user.id,
          p_request_id: body?.requestId ?? null,
          p_category: body?.category ? String(body.category).trim() : null,
        },
      );
      if (error) throw error;
      return json({ ok: true, request: data?.request ?? null });
    }

    if (action === "select-provider") {
      if (!isUuid(body?.requestId) || !isUuid(body?.providerId)) {
        return json({ error: "Selección inválida." }, 400);
      }
      const { data, error } = await admin.rpc(
        "select_urgent_service_provider_internal",
        {
          p_client_id: user.id,
          p_request_id: body.requestId,
          p_provider_id: body.providerId,
        },
      );
      if (error || !data?.ok) throw error ?? new Error("URGENT_SELECT_FAILED");

      if (!data.already_matched) {
        await sendPush(
          data.provider_expo_token,
          "Te eligieron para un pedido urgente",
          `Abrí el chat del pedido ${data.request_code} y enviá tu presupuesto.`,
          {
            type: "urgent_provider_selected",
            screen: "ChatIndividual",
            params: {
              chatId: data.chat_id,
              nombre: "Cliente",
              servicioId: "",
              usuarioId1: data.participant_a,
              usuarioId2: data.participant_b,
            },
          },
        ).catch(() => null);
      }

      return json({
        ok: true,
        match: {
          chatId: data.chat_id,
          providerId: data.provider_id,
          providerName: data.provider_name,
          participantA: data.participant_a,
          participantB: data.participant_b,
        },
      });
    }

    if (action === "cancel") {
      if (!isUuid(body?.requestId)) {
        return json({ error: "Pedido inválido." }, 400);
      }
      const { data, error } = await admin.rpc(
        "cancel_urgent_service_request_internal",
        { p_client_id: user.id, p_request_id: body.requestId },
      );
      if (error) throw error;
      return json({ ok: true, status: data?.status ?? "cancelled" });
    }

    return json({ error: "Acción no permitida." }, 400);
  } catch (error) {
    console.error("[urgent-service]", error);
    return errorResponse(error);
  }
});
