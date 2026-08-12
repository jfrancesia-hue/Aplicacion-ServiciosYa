import { createClient } from "npm:@supabase/supabase-js@2";

type SupabaseAdmin = ReturnType<typeof createClient>;

type UrgentWorkAlert = {
  id: string;
  created_at: string;
  source: "service_request" | "direct_contact" | "chat_message";
  status: "pending" | "declined" | "expired";
  worker_id: string;
  cliente_id: string | null;
  servicio_id: string | null;
  chat_id: string | null;
  notificacion_id: string | null;
  category: string | null;
  title: string;
  body: string;
  attempts_sent: number;
  response_deadline: string;
  root_alert_id: string | null;
  assignment_round: number;
  metadata: Record<string, unknown>;
};

type UrgentPolicy = {
  sla_minutes: number;
  reminder_minutes: number;
  max_reassignments: number;
};

const EXPO_API_URL = "https://exp.host/--/api/v2/push/send";
const URGENT_WORK_CHANNEL_ID = "urgent-work";
const URGENT_WORK_SOUND = "urgent_work.wav";

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function matchesCategory(raw: unknown, category: string | null) {
  if (!category) return true;
  const expected = normalize(category);
  const values = Array.isArray(raw) ? raw : [raw];
  return values.some((item) => {
    const current = normalize(item);
    return (
      current === expected ||
      current.includes(expected) ||
      expected.includes(current)
    );
  });
}

async function sendExpoPush(token: string, alert: UrgentWorkAlert) {
  const firstAttempt = alert.attempts_sent === 0;
  const response = await fetch(EXPO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(Deno.env.get("EXPO_ACCESS_TOKEN")
        ? { Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` }
        : {}),
    },
    body: JSON.stringify({
      to: token,
      priority: "high",
      channelId: URGENT_WORK_CHANNEL_ID,
      sound: URGENT_WORK_SOUND,
      title: firstAttempt
        ? "Solicitud urgente · respondé en 20 min"
        : "Recordatorio urgente · quedan 10 min",
      body: firstAttempt
        ? alert.body
        : "Aceptá o rechazá explícitamente la solicitud desde Notificaciones.",
      data: {
        type: "urgent_work_request",
        alertId: alert.id,
        screen: "Notificaciones",
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.data?.status === "error") {
    throw new Error(payload?.data?.message || `Expo push ${response.status}`);
  }
}

async function enqueueClientUpdate(
  supabase: SupabaseAdmin,
  alert: UrgentWorkAlert,
  event: string,
  title: string,
  body: string,
) {
  if (!alert.cliente_id) return;
  await supabase.rpc("enqueue_transactional_notification", {
    p_event_key: `${event}:${alert.id}`,
    p_user_id: alert.cliente_id,
    p_event_type: event,
    p_title: title,
    p_body: body,
    p_action_screen: alert.chat_id ? "ChatIndividual" : "Notificaciones",
    p_action_params: alert.chat_id ? { chatId: alert.chat_id } : {},
    p_scheduled_for: new Date().toISOString(),
    p_metadata: { urgent_alert_id: alert.id },
  });
}

async function createReplacement(
  supabase: SupabaseAdmin,
  alert: UrgentWorkAlert,
  policy: UrgentPolicy,
) {
  const nextRound = alert.assignment_round + 1;
  if (nextRound - 1 > policy.max_reassignments || !alert.cliente_id)
    return null;

  const rootId = alert.root_alert_id || alert.id;
  const [
    { data: previous },
    { data: suspended },
    { data: originalWorker },
    { data: workers },
  ] = await Promise.all([
    supabase
      .from("urgent_work_alerts")
      .select("worker_id")
      .eq("root_alert_id", rootId),
    supabase
      .from("worker_urgent_discipline")
      .select("worker_id")
      .gt("priority_suspended_until", new Date().toISOString()),
    supabase
      .from("usuarios")
      .select("ciudad,provincia")
      .eq("id", alert.worker_id)
      .maybeSingle(),
    supabase
      .from("usuarios")
      .select("id,nombre,categoria,expo_token,ciudad,provincia")
      .eq("rol", "worker")
      .eq("perfilPublico", true)
      .limit(100),
  ]);
  const excluded = new Set([
    alert.worker_id,
    ...(previous ?? []).map((item: { worker_id: string }) => item.worker_id),
    ...(suspended ?? []).map((item: { worker_id: string }) => item.worker_id),
  ]);
  const candidate = (workers ?? []).find(
    (worker: {
      id: string;
      categoria: unknown;
      ciudad: string | null;
      provincia: string | null;
    }) =>
      !excluded.has(worker.id) &&
      matchesCategory(worker.categoria, alert.category) &&
      (!originalWorker?.provincia ||
        normalize(worker.provincia) === normalize(originalWorker.provincia)) &&
      (!originalWorker?.ciudad ||
        normalize(worker.ciudad) === normalize(originalWorker.ciudad)),
  );
  if (!candidate) return null;

  const now = new Date().toISOString();
  const deadline = addMinutes(now, policy.sla_minutes);
  const body = `Un cliente necesita ${alert.category || "un servicio"}. Confirmá en 20 minutos si podés atenderlo.`;
  const { data: replacement, error } = await supabase
    .from("urgent_work_alerts")
    .insert({
      source: alert.source === "chat_message" ? "direct_contact" : alert.source,
      status: "pending",
      worker_id: candidate.id,
      cliente_id: alert.cliente_id,
      servicio_id: null,
      chat_id: null,
      category: alert.category,
      title: "Trabajo urgente",
      body,
      attempts_sent: 0,
      next_attempt_at: now,
      response_deadline: deadline,
      root_alert_id: rootId,
      reassigned_from_id: alert.id,
      assignment_round: nextRound,
      metadata: {
        ...(alert.metadata || {}),
        reassigned_from_worker_id: alert.worker_id,
      },
    })
    .select("*")
    .single();
  if (error || !replacement) throw error || new Error("URGENT_REASSIGN_FAILED");

  const { data: notification, error: notificationError } = await supabase
    .from("notificaciones")
    .insert({
      receptor_id: candidate.id,
      emisor_id: alert.cliente_id,
      mensaje: body,
      estado: "urgente_pendiente",
      leido: false,
      urgent_work_alert_id: replacement.id,
      urgent_response_deadline: deadline,
    })
    .select("id")
    .single();
  if (notificationError) throw notificationError;

  await Promise.all([
    supabase
      .from("urgent_work_alerts")
      .update({ notificacion_id: notification.id })
      .eq("id", replacement.id),
    supabase
      .from("urgent_work_alerts")
      .update({
        status: alert.status === "expired" ? "expired" : "reassigned",
        reassigned_alert_id: replacement.id,
        reassignment_processed_at: new Date().toISOString(),
        processing_at: null,
      })
      .eq("id", alert.id),
  ]);

  if (candidate.expo_token) {
    await sendExpoPush(candidate.expo_token, replacement as UrgentWorkAlert);
    await supabase
      .from("urgent_work_alerts")
      .update({
        attempts_sent: 1,
        last_sent_at: new Date().toISOString(),
        next_attempt_at: addMinutes(
          replacement.created_at,
          policy.reminder_minutes,
        ),
      })
      .eq("id", replacement.id);
  }
  return replacement.id as string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST")
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    return Response.json(
      { ok: false, error: "Missing Supabase env vars" },
      { status: 500 },
    );

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const [{ data: policyData, error: policyError }, { data, error }] =
    await Promise.all([
      supabase
        .from("urgent_work_policy")
        .select("sla_minutes,reminder_minutes,max_reassignments")
        .eq("singleton", true)
        .single(),
      supabase.rpc("claim_due_urgent_work_alerts", { p_limit: 100 }),
    ]);
  if (policyError || error)
    return Response.json(
      { ok: false, error: policyError?.message || error?.message },
      { status: 500 },
    );
  const policy = policyData as UrgentPolicy;
  const alerts = (data ?? []) as UrgentWorkAlert[];
  const results: Array<Record<string, unknown>> = [];

  for (const alert of alerts) {
    try {
      if (alert.status === "declined") {
        const replacementId = await createReplacement(supabase, alert, policy);
        if (!replacementId) {
          await supabase
            .from("urgent_work_alerts")
            .update({
              reassignment_processed_at: new Date().toISOString(),
              processing_at: null,
            })
            .eq("id", alert.id);
        }
        await enqueueClientUpdate(
          supabase,
          alert,
          "urgent_declined",
          "El prestador no está disponible",
          replacementId
            ? "La solicitud urgente fue reasignada a otro prestador."
            : "No encontramos otro prestador disponible por ahora.",
        );
        results.push({ id: alert.id, action: "declined", replacementId });
        continue;
      }

      if (
        alert.status === "expired" ||
        new Date(alert.response_deadline).getTime() <= Date.now()
      ) {
        const now = new Date().toISOString();
        await supabase
          .from("urgent_work_alerts")
          .update({
            status: "expired",
            missed_at: now,
            processing_at: null,
            updated_at: now,
          })
          .eq("id", alert.id);
        await supabase.from("urgent_work_misses").upsert(
          {
            alert_id: alert.id,
            worker_id: alert.worker_id,
            occurred_at: now,
            response_deadline: alert.response_deadline,
            assignment_round: alert.assignment_round,
          },
          { onConflict: "alert_id", ignoreDuplicates: true },
        );
        await supabase
          .from("notificaciones")
          .update({ estado: "urgente_vencida", leido: true })
          .eq("urgent_work_alert_id", alert.id);
        const replacementId = await createReplacement(
          supabase,
          { ...alert, status: "expired" },
          policy,
        );
        if (!replacementId) {
          await supabase
            .from("urgent_work_alerts")
            .update({
              reassignment_processed_at: new Date().toISOString(),
              processing_at: null,
            })
            .eq("id", alert.id);
        }
        await enqueueClientUpdate(
          supabase,
          alert,
          "urgent_expired",
          "Venció la solicitud urgente",
          replacementId
            ? "No hubo respuesta en 20 minutos y reasignamos la solicitud."
            : "No hubo respuesta en 20 minutos y no encontramos reemplazo disponible.",
        );
        results.push({ id: alert.id, action: "expired", replacementId });
        continue;
      }

      const { data: worker } = await supabase
        .from("usuarios")
        .select("expo_token")
        .eq("id", alert.worker_id)
        .maybeSingle();
      if (worker?.expo_token) await sendExpoPush(worker.expo_token, alert);
      const attempts = alert.attempts_sent + 1;
      const reminderAt = addMinutes(alert.created_at, policy.reminder_minutes);
      await supabase
        .from("urgent_work_alerts")
        .update({
          attempts_sent: attempts,
          last_sent_at: new Date().toISOString(),
          next_attempt_at: attempts >= 2 ? alert.response_deadline : reminderAt,
          processing_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", alert.id);
      results.push({
        id: alert.id,
        action: attempts === 1 ? "initial" : "reminder",
      });
    } catch (caught) {
      await supabase
        .from("urgent_work_alerts")
        .update({
          processing_at: null,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(alert.metadata || {}),
            last_error:
              caught instanceof Error ? caught.message : String(caught),
          },
        })
        .eq("id", alert.id);
      results.push({
        id: alert.id,
        action: "failed",
        error: caught instanceof Error ? caught.message : String(caught),
      });
    }
  }

  return Response.json({ ok: true, processed: alerts.length, results });
});
