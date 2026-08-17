import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REPORT_STATUSES = new Set([
  "pending",
  "reviewing",
  "resolved",
  "dismissed",
]);

const FUNNEL_STEPS = [
  ["marketplace_category_opened", "Categoría abierta"],
  ["marketplace_providers_loaded", "Prestadores encontrados"],
  ["marketplace_provider_profile_viewed", "Perfil visitado"],
  ["marketplace_safe_chat_opened", "Chat iniciado"],
  ["marketplace_quote_sent", "Presupuesto enviado"],
  ["marketplace_payment_started", "Pago iniciado"],
  ["marketplace_payment_confirmed", "Pago confirmado"],
  ["marketplace_job_completed", "Trabajo terminado"],
  ["marketplace_rating_submitted", "Calificación recibida"],
] as const;

const ISSUE_STEPS = [
  ["marketplace_search_failed", "Búsquedas con error"],
  ["marketplace_audio_transcription_failed", "Audios sin transcribir"],
  ["marketplace_mica_response_failed", "Respuestas MICA fallidas"],
  ["marketplace_payment_failed", "Pagos con error"],
] as const;

type EventRow = {
  user_id: string;
  event_name: string;
  province: string | null;
  city: string | null;
  category: string | null;
  created_at: string;
};

type ProviderLocationRow = {
  provincia: string | null;
};

type WorkerStateRow = {
  status: string | null;
  available_until: string | null;
  last_seen_at: string | null;
};

type PaymentRow = {
  status: string;
  job_status: string;
  created_at: string;
};

type CancellationRequestRow = {
  id: string;
  request_code: string;
  payment_record_id: string;
  requested_by: string;
  requester_role: string;
  reason_code: string;
  reason_detail: string | null;
  status: "review_required" | "refund_failed" | "refund_pending";
  auto_refund: boolean;
  error_message: string | null;
  created_at: string;
};

type CancellationPaymentRow = {
  id: string;
  payer_id: string;
  provider_id: string;
  commission_amount: number;
  currency: string;
  visit_status: string;
  visit_scheduled_for: string | null;
};

type CancellationUserRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
};

type TrustSummaryRow = {
  completed_jobs: number | null;
  average_rating: number | null;
  review_count: number | null;
  average_response_minutes: number | null;
  response_sample_size: number | null;
};

type ReportRow = {
  id: string;
  provider_id: string;
  reason_category: string;
  details: string | null;
  status: string;
  service_id: number | null;
  created_at: string;
};

type LegacyReportRow = {
  id: string;
  reason_category: string;
  details: string | null;
  status: string;
  service_id: number;
  created_at: string | null;
};

type IncidentRow = {
  id: string;
  case_number: string;
  payment_record_id: string;
  chat_id: string;
  provider_id: string;
  category: string;
  details: string | null;
  mica_summary: string | null;
  status: string;
  created_at: string;
};

type ServiceOwnerRow = {
  id: number;
  user_id: string | null;
  usuario_id: string | null;
};

type ProviderProfileRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  provincia: string | null;
  ciudad: string | null;
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

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function displayProvince(value?: string | null) {
  const clean = String(value ?? "").trim();
  return clean || "Sin provincia";
}

async function requireAdmin(
  admin: ReturnType<typeof createClient>,
  req: Request,
) {
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  const userId = data.user?.id;
  if (error || !userId) return null;

  const { data: profile } = await admin
    .from("usuarios")
    .select("id,rol")
    .eq("id", userId)
    .maybeSingle();

  return profile?.rol === "admin" ? data.user : null;
}

async function buildSummary(
  admin: ReturnType<typeof createClient>,
  requestedDays: unknown,
) {
  const parsedDays = Number(requestedDays);
  const days = Number.isFinite(parsedDays)
    ? Math.min(90, Math.max(1, Math.round(parsedDays)))
    : 30;
  const now = new Date();
  const periodStart = new Date(
    now.getTime() - days * 24 * 60 * 60 * 1000,
  ).toISOString();
  const recentAvailabilityStart = new Date(
    now.getTime() - 30 * 60 * 1000,
  ).toISOString();
  const messagesStart = new Date(
    now.getTime() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    providersResult,
    campaignResult,
    workerStatesResult,
    chatsResult,
    messagesResult,
    profileReportsResult,
    legacyReportsResult,
    incidentsResult,
    paymentsResult,
    eventsResult,
    reviewsResult,
    providerLocationsResult,
    trustResult,
    cancellationResult,
  ] = await Promise.all([
    admin
      .from("provider_trust_summary")
      .select("provider_id", { count: "exact", head: true }),
    admin.from("sy_perfiles").select("id", { count: "exact", head: true }),
    admin
      .from("workers")
      .select("status,available_until,last_seen_at")
      .limit(5000),
    admin
      .from("chats")
      .select("id", { count: "exact", head: true })
      .gte("updated_at", periodStart),
    admin
      .from("mensajes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", messagesStart),
    admin
      .from("profile_reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "reviewing"]),
    admin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "reviewing"]),
    admin
      .from("service_job_incidents")
      .select("id", { count: "exact", head: true })
      .in("status", ["mica_intake", "escalated", "reviewing"]),
    admin
      .from("service_confirmation_payments")
      .select("status,job_status,created_at")
      .gte("created_at", periodStart)
      .limit(5000),
    admin
      .from("marketplace_events")
      .select("user_id,event_name,province,city,category,created_at")
      .gte("created_at", periodStart)
      .limit(10000),
    admin
      .from("service_job_reviews")
      .select("id", { count: "exact", head: true })
      .gte("created_at", periodStart),
    admin.from("usuarios").select("provincia").eq("rol", "worker").limit(5000),
    admin
      .from("provider_trust_summary")
      .select(
        "completed_jobs,average_rating,review_count,average_response_minutes,response_sample_size",
      )
      .limit(5000),
    admin
      .from("service_cancellation_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["review_required", "refund_failed", "refund_pending"]),
  ]);

  const failures = [
    providersResult.error,
    campaignResult.error,
    workerStatesResult.error,
    chatsResult.error,
    messagesResult.error,
    profileReportsResult.error,
    legacyReportsResult.error,
    incidentsResult.error,
    paymentsResult.error,
    eventsResult.error,
    reviewsResult.error,
    providerLocationsResult.error,
    trustResult.error,
    cancellationResult.error,
  ].filter(Boolean);
  if (failures.length > 0) {
    throw new Error(failures[0]?.message ?? "No se pudo armar el panel.");
  }

  const workerStates = (workerStatesResult.data ?? []) as WorkerStateRow[];
  const availableNow = workerStates.filter((worker) => {
    if (worker.status !== "ONLINE") return false;
    if (worker.available_until) {
      return new Date(worker.available_until).getTime() > now.getTime();
    }
    return Boolean(
      worker.last_seen_at && worker.last_seen_at >= recentAvailabilityStart,
    );
  }).length;

  const payments = (paymentsResult.data ?? []) as PaymentRow[];
  const paymentCounts = {
    approved: payments.filter((payment) => payment.status === "approved")
      .length,
    pending: payments.filter((payment) =>
      ["creating", "pending"].includes(payment.status),
    ).length,
    failed: payments.filter((payment) =>
      ["rejected", "cancelled", "error"].includes(payment.status),
    ).length,
    completed: payments.filter((payment) => payment.job_status === "completed")
      .length,
    disputed: payments.filter((payment) => payment.job_status === "disputed")
      .length,
  };

  const events = (eventsResult.data ?? []) as EventRow[];
  const eventUsers = new Map<string, Set<string>>();
  const eventCounts = new Map<string, number>();
  for (const event of events) {
    eventCounts.set(
      event.event_name,
      (eventCounts.get(event.event_name) ?? 0) + 1,
    );
    const users = eventUsers.get(event.event_name) ?? new Set<string>();
    users.add(event.user_id);
    eventUsers.set(event.event_name, users);
  }

  const funnel = FUNNEL_STEPS.map(([eventName, label]) => ({
    eventName,
    label,
    events: eventCounts.get(eventName) ?? 0,
    users: eventUsers.get(eventName)?.size ?? 0,
  }));

  const issues = ISSUE_STEPS.map(([eventName, label]) => ({
    eventName,
    label,
    count: eventCounts.get(eventName) ?? 0,
  }));

  const provinceCounts = new Map<string, number>();
  for (const provider of (providerLocationsResult.data ??
    []) as ProviderLocationRow[]) {
    const province = displayProvince(provider.provincia);
    const key = normalizeText(province);
    const current = Array.from(provinceCounts.entries()).find(
      ([stored]) => normalizeText(stored) === key,
    )?.[0];
    const label = current ?? province;
    provinceCounts.set(label, (provinceCounts.get(label) ?? 0) + 1);
  }
  const provinces = Array.from(provinceCounts.entries())
    .map(([province, count]) => ({ province, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const trustRows = (trustResult.data ?? []) as TrustSummaryRow[];
  const measuredResponseProviders = trustRows.filter(
    (row) =>
      Number(row.response_sample_size ?? 0) >= 3 &&
      row.average_response_minutes != null,
  );
  const averageResponseMinutes =
    measuredResponseProviders.length > 0
      ? Math.round(
          measuredResponseProviders.reduce(
            (total, row) => total + Number(row.average_response_minutes ?? 0),
            0,
          ) / measuredResponseProviders.length,
        )
      : null;

  return {
    ok: true,
    generatedAt: now.toISOString(),
    periodDays: days,
    counts: {
      providers: providersResult.count ?? 0,
      campaignProfiles: campaignResult.count ?? 0,
      availableNow,
      chatsInPeriod: chatsResult.count ?? 0,
      messagesLast24Hours: messagesResult.count ?? 0,
      openReports:
        (profileReportsResult.count ?? 0) +
        (legacyReportsResult.count ?? 0) +
        (incidentsResult.count ?? 0),
      openCancellations: cancellationResult.count ?? 0,
      reviewsInPeriod: reviewsResult.count ?? 0,
      measuredResponseProviders: measuredResponseProviders.length,
      averageResponseMinutes,
    },
    payments: paymentCounts,
    funnel,
    issues,
    provinces,
  };
}

async function getReports(admin: ReturnType<typeof createClient>) {
  const [profileResult, legacyResult, incidentResult] = await Promise.all([
    admin
      .from("profile_reports")
      .select(
        "id,provider_id,reason_category,details,status,service_id,created_at",
      )
      .in("status", ["pending", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("reports")
      .select("id,reason_category,details,status,service_id,created_at")
      .in("status", ["pending", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("service_job_incidents")
      .select(
        "id,case_number,payment_record_id,chat_id,provider_id,category,details,mica_summary,status,created_at",
      )
      .in("status", ["mica_intake", "escalated", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (legacyResult.error) throw legacyResult.error;
  if (incidentResult.error) throw incidentResult.error;

  const profileReports = (profileResult.data ?? []) as ReportRow[];
  const legacyReports = (legacyResult.data ?? []) as LegacyReportRow[];
  const incidents = (incidentResult.data ?? []) as IncidentRow[];
  const serviceIds = Array.from(
    new Set(legacyReports.map((report) => report.service_id)),
  );
  const { data: rawServices, error: servicesError } = serviceIds.length
    ? await admin
        .from("servicios")
        .select("id,user_id,usuario_id")
        .in("id", serviceIds)
    : { data: [], error: null };
  if (servicesError) throw servicesError;

  const services = (rawServices ?? []) as ServiceOwnerRow[];
  const servicesById = new Map(
    services.map((service) => [service.id, service]),
  );
  const reports = [
    ...profileReports.map((report) => ({
      ...report,
      source: "profile" as const,
    })),
    ...legacyReports.map((report) => {
      const service = servicesById.get(report.service_id);
      return {
        ...report,
        provider_id: service?.user_id ?? service?.usuario_id ?? "",
        created_at: report.created_at ?? new Date(0).toISOString(),
        source: "service" as const,
      };
    }),
    ...incidents.map((incident) => ({
      id: incident.id,
      source: "incident" as const,
      provider_id: incident.provider_id,
      reason_category: incident.category,
      details: [incident.mica_summary, incident.details]
        .filter(Boolean)
        .join("\n"),
      status: incident.status,
      service_id: null,
      created_at: incident.created_at,
      case_number: incident.case_number,
      chat_id: incident.chat_id,
      payment_record_id: incident.payment_record_id,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 50);

  const providerIds = Array.from(
    new Set(reports.map((report) => report.provider_id).filter(Boolean)),
  );
  const { data: rawProviders, error: providersError } = providerIds.length
    ? await admin
        .from("usuarios")
        .select("id,nombre,apellido,provincia,ciudad")
        .in("id", providerIds)
    : { data: [], error: null };
  if (providersError) throw providersError;
  const providers = (rawProviders ?? []) as ProviderProfileRow[];

  const providersById = new Map(
    providers.map((provider) => [provider.id, provider]),
  );

  return {
    ok: true,
    reports: reports.map((report) => {
      const provider = providersById.get(report.provider_id);
      return {
        ...report,
        providerName:
          [provider?.nombre, provider?.apellido].filter(Boolean).join(" ") ||
          "Prestador sin nombre",
        providerLocation:
          [provider?.ciudad, provider?.provincia].filter(Boolean).join(", ") ||
          "Sin ubicación",
      };
    }),
  };
}

async function updateReport(
  admin: ReturnType<typeof createClient>,
  reportId: unknown,
  status: unknown,
  source: unknown,
  adminUserId?: string,
) {
  const cleanId = String(reportId ?? "").trim();
  const cleanStatus = String(status ?? "").trim();
  const table =
    source === "service"
      ? "reports"
      : source === "incident"
        ? "service_job_incidents"
        : "profile_reports";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      cleanId,
    ) ||
    !REPORT_STATUSES.has(cleanStatus)
  ) {
    return json({ error: "Datos de moderación inválidos." }, 400);
  }

  const updatePayload =
    source === "incident"
      ? {
          status: cleanStatus,
          assigned_to: cleanStatus === "reviewing" ? adminUserId : undefined,
          resolved_at: ["resolved", "dismissed"].includes(cleanStatus)
            ? new Date().toISOString()
            : null,
          updated_at: new Date().toISOString(),
        }
      : { status: cleanStatus };
  const { data, error } = await admin
    .from(table)
    .update(updatePayload)
    .eq("id", cleanId)
    .select("id,status")
    .maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: "Reporte no encontrado." }, 404);

  return json({ ok: true, report: data });
}

async function getConsumerRightRequests(
  admin: ReturnType<typeof createClient>,
) {
  const { data, error } = await admin
    .from("consumer_right_requests")
    .select(
      "id,request_code,request_type,email,operation_reference,details,status,created_at",
    )
    .in("status", ["received", "reviewing"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return { ok: true, requests: data ?? [] };
}

async function updateConsumerRightRequest(
  admin: ReturnType<typeof createClient>,
  requestId: unknown,
  status: unknown,
) {
  const cleanId = String(requestId ?? "").trim();
  const cleanStatus = String(status ?? "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      cleanId,
    ) ||
    !["reviewing", "completed", "rejected"].includes(cleanStatus)
  ) {
    return json({ error: "Solicitud de consumidor inválida." }, 400);
  }

  const { data, error } = await admin
    .from("consumer_right_requests")
    .update({
      status: cleanStatus,
      updated_at: new Date().toISOString(),
      resolved_at: ["completed", "rejected"].includes(cleanStatus)
        ? new Date().toISOString()
        : null,
    })
    .eq("id", cleanId)
    .select("id,status")
    .maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: "Solicitud no encontrada." }, 404);
  return json({ ok: true, request: data });
}

type UrgentPolicyRow = {
  sla_minutes: number;
  reminder_minutes: number;
  max_reassignments: number;
  enforcement_enabled: boolean;
  missed_threshold: number;
  window_days: number;
  priority_suspension_days: number;
  recurrence_window_days: number;
  second_suspension_days: number;
  subsequent_suspension_days: number;
  enforcement_started_at: string | null;
  updated_at: string;
};

function urgentPolicyPayload(policy: UrgentPolicyRow) {
  return {
    slaMinutes: policy.sla_minutes,
    reminderMinutes: policy.reminder_minutes,
    maxReassignments: policy.max_reassignments,
    enforcementEnabled: policy.enforcement_enabled,
    missedThreshold: policy.missed_threshold,
    windowDays: policy.window_days,
    prioritySuspensionDays: policy.priority_suspension_days,
    recurrenceWindowDays: policy.recurrence_window_days,
    secondSuspensionDays: policy.second_suspension_days,
    subsequentSuspensionDays: policy.subsequent_suspension_days,
    enforcementStartedAt: policy.enforcement_started_at,
    updatedAt: policy.updated_at,
  };
}

async function getUrgencyPolicy(admin: ReturnType<typeof createClient>) {
  const { data: policyData, error: policyError } = await admin
    .from("urgent_work_policy")
    .select(
      "sla_minutes,reminder_minutes,max_reassignments,enforcement_enabled,missed_threshold,window_days,priority_suspension_days,recurrence_window_days,second_suspension_days,subsequent_suspension_days,enforcement_started_at,updated_at",
    )
    .eq("singleton", true)
    .single();
  if (policyError) throw policyError;

  const policy = policyData as UrgentPolicyRow;
  const windowStart = new Date(
    Date.now() - policy.window_days * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [missesResult, suspensionsResult] = await Promise.all([
    admin
      .from("urgent_work_misses")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", windowStart),
    admin
      .from("worker_urgent_discipline")
      .select("worker_id", { count: "exact", head: true })
      .gt("priority_suspended_until", new Date().toISOString()),
  ]);
  if (missesResult.error) throw missesResult.error;
  if (suspensionsResult.error) throw suspensionsResult.error;

  return {
    ok: true,
    policy: urgentPolicyPayload(policy),
    metrics: {
      missesInWindow: missesResult.count ?? 0,
      activeSuspensions: suspensionsResult.count ?? 0,
    },
  };
}

function integerInRange(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

async function updateUrgencyPolicy(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  adminUserId: string,
) {
  const enforcementEnabled = body?.enforcementEnabled;
  const missedThreshold = integerInRange(body?.missedThreshold, 1, 20);
  const windowDays = integerInRange(body?.windowDays, 1, 365);
  const prioritySuspensionDays = integerInRange(
    body?.prioritySuspensionDays,
    1,
    90,
  );
  const maxReassignments = integerInRange(body?.maxReassignments, 0, 10);
  if (
    typeof enforcementEnabled !== "boolean" ||
    missedThreshold == null ||
    windowDays == null ||
    prioritySuspensionDays == null ||
    maxReassignments == null
  ) {
    return json({ error: "Configuración de urgencias inválida." }, 400);
  }

  const { error } = await admin.rpc("set_urgent_work_policy", {
    p_enforcement_enabled: enforcementEnabled,
    p_missed_threshold: missedThreshold,
    p_window_days: windowDays,
    p_priority_suspension_days: prioritySuspensionDays,
    p_max_reassignments: maxReassignments,
    p_updated_by: adminUserId,
  });
  if (error) throw error;
  return json(await getUrgencyPolicy(admin));
}

async function getNotificationHealth(admin: ReturnType<typeof createClient>) {
  const [
    waitingEmailResult,
    pendingEmailResult,
    failedEmailResult,
    sentEmailResult,
    failedPushResult,
  ] = await Promise.all([
    admin
      .from("transactional_notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("email_status", "waiting_configuration"),
    admin
      .from("transactional_notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("email_status", "pending"),
    admin
      .from("transactional_notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("email_status", "failed"),
    admin
      .from("transactional_notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("email_status", "sent"),
    admin
      .from("transactional_notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("push_status", "failed"),
  ]);
  const failure = [
    waitingEmailResult.error,
    pendingEmailResult.error,
    failedEmailResult.error,
    sentEmailResult.error,
    failedPushResult.error,
  ].find(Boolean);
  if (failure) throw failure;

  return {
    ok: true,
    providers: {
      emailConfigured: Boolean(
        Deno.env.get("RESEND_API_KEY") &&
          Deno.env.get("TRANSACTIONAL_EMAIL_FROM"),
      ),
      pushAccessTokenConfigured: Boolean(Deno.env.get("EXPO_ACCESS_TOKEN")),
    },
    outbox: {
      waitingEmail: waitingEmailResult.count ?? 0,
      pendingEmail: pendingEmailResult.count ?? 0,
      failedEmail: failedEmailResult.count ?? 0,
      sentEmail: sentEmailResult.count ?? 0,
      failedPush: failedPushResult.count ?? 0,
    },
  };
}

async function getCancellationRequests(
  admin: ReturnType<typeof createClient>,
) {
  const { data, error } = await admin
    .from("service_cancellation_requests")
    .select(
      "id,request_code,payment_record_id,requested_by,requester_role,reason_code,reason_detail,status,auto_refund,error_message,created_at",
    )
    .in("status", ["review_required", "refund_failed", "refund_pending"])
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;

  const requests = (data ?? []) as CancellationRequestRow[];
  const paymentIds = requests.map((request) => request.payment_record_id);
  const { data: rawPayments, error: paymentError } = paymentIds.length
    ? await admin
        .from("service_confirmation_payments")
        .select(
          "id,payer_id,provider_id,commission_amount,currency,visit_status,visit_scheduled_for",
        )
        .in("id", paymentIds)
    : { data: [], error: null };
  if (paymentError) throw paymentError;

  const payments = (rawPayments ?? []) as CancellationPaymentRow[];
  const paymentsById = new Map(
    payments.map((payment) => [payment.id, payment]),
  );
  const userIds = Array.from(
    new Set(
      payments.flatMap((payment) => [payment.payer_id, payment.provider_id]),
    ),
  );
  const { data: rawUsers, error: userError } = userIds.length
    ? await admin
        .from("usuarios")
        .select("id,nombre,apellido")
        .in("id", userIds)
    : { data: [], error: null };
  if (userError) throw userError;

  const users = (rawUsers ?? []) as CancellationUserRow[];
  const usersById = new Map(users.map((user) => [user.id, user]));
  const displayName = (userId?: string) => {
    const user = userId ? usersById.get(userId) : null;
    return (
      [user?.nombre, user?.apellido].filter(Boolean).join(" ") ||
      "Usuario sin nombre"
    );
  };

  return {
    ok: true,
    cancellations: requests.map((request) => {
      const payment = paymentsById.get(request.payment_record_id);
      return {
        ...request,
        commission_amount: Number(payment?.commission_amount ?? 0),
        currency: payment?.currency ?? "ARS",
        visit_status: payment?.visit_status ?? "unknown",
        visit_scheduled_for: payment?.visit_scheduled_for ?? null,
        client_name: displayName(payment?.payer_id),
        provider_name: displayName(payment?.provider_id),
      };
    }),
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function sameAmount(left: unknown, right: unknown) {
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.01;
}

async function resolveCancellation(
  admin: ReturnType<typeof createClient>,
  requestId: unknown,
  decision: unknown,
  resolutionNote: unknown,
  adminUserId: string,
) {
  const cleanRequestId = String(requestId ?? "").trim();
  const cleanDecision = String(decision ?? "").trim();
  const cleanNote = String(resolutionNote ?? "").trim().slice(0, 800);
  if (!isUuid(cleanRequestId) || !["refund", "reject"].includes(cleanDecision)) {
    return json({ error: "Resolución de cancelación inválida." }, 400);
  }

  if (cleanDecision === "reject") {
    const { data, error } = await admin.rpc(
      "reject_service_cancellation_review_internal",
      {
        p_request_id: cleanRequestId,
        p_resolved_by: adminUserId,
        p_resolution_note:
          cleanNote ||
          "La revisión determinó que no corresponde devolver el cargo de reserva.",
      },
    );
    if (error) throw error;
    return json({ ok: true, resolution: data });
  }

  const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!mercadoPagoToken) {
    return json({ error: "Mercado Pago no está configurado." }, 503);
  }

  const { data: prepared, error: prepareError } = await admin.rpc(
    "prepare_service_cancellation_refund_internal",
    { p_request_id: cleanRequestId, p_resolved_by: adminUserId },
  );
  if (prepareError) throw prepareError;
  if (prepared?.already_refunded) {
    return json({ ok: true, refunded: true, resolution: prepared });
  }

  const paymentId = String(prepared?.payment_id ?? "");
  const paymentRecordId = String(prepared?.payment_record_id ?? "");
  const expectedAmount = Number(prepared?.refund_amount ?? 0);
  if (!/^\d{4,32}$/.test(paymentId) || !isUuid(paymentRecordId)) {
    throw new Error("La reserva no tiene un pago válido para devolver.");
  }

  try {
    const refundResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mercadoPagoToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": cleanRequestId,
        },
        body: "{}",
      },
    );
    let providerRefund = await refundResponse.json().catch(() => ({}));

    if (!refundResponse.ok) {
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
        { headers: { Authorization: `Bearer ${mercadoPagoToken}` } },
      );
      const providerPayment = await paymentResponse.json().catch(() => ({}));
      if (
        !paymentResponse.ok ||
        String(providerPayment?.status ?? "") !== "refunded"
      ) {
        throw new Error(
          String(providerRefund?.message ?? "Mercado Pago rechazó el reintegro."),
        );
      }
      const refunds = Array.isArray(providerPayment?.refunds)
        ? providerPayment.refunds
        : [];
      providerRefund = refunds.at(-1) ?? {
        id: "",
        amount: providerPayment?.transaction_amount,
        status: "approved",
      };
    }

    const refundAmount = Number(providerRefund?.amount ?? expectedAmount);
    if (!sameAmount(refundAmount, expectedAmount)) {
      throw new Error("Mercado Pago informó un importe de reintegro distinto.");
    }

    const { data: reconciled, error: reconcileError } = await admin.rpc(
      "reconcile_service_reservation_refund",
      {
        p_payment_record_id: paymentRecordId,
        p_request_id: cleanRequestId,
        p_payment_id: paymentId,
        p_refund_id: String(providerRefund?.id ?? ""),
        p_refund_amount: refundAmount,
        p_provider_status: String(providerRefund?.status ?? "refunded"),
      },
    );
    if (reconcileError || !reconciled?.refunded) {
      throw reconcileError ?? new Error("No se pudo conciliar el reintegro.");
    }
    return json({ ok: true, refunded: true, resolution: reconciled });
  } catch (error) {
    await admin.rpc("fail_service_reservation_refund", {
      p_request_id: cleanRequestId,
      p_error_message:
        error instanceof Error ? error.message : "Error al procesar reintegro",
      p_provider_status: "admin_refund_error",
    });
    throw error;
  }
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
      return json({ error: "Configuración incompleta." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const currentAdmin = await requireAdmin(admin, req);
    if (!currentAdmin) {
      return json({ error: "Acceso exclusivo para administradores." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "summary";
    if (action === "summary") {
      return json(await buildSummary(admin, body?.days));
    }
    if (action === "reports") {
      return json(await getReports(admin));
    }
    if (action === "cancellation-requests") {
      return json(await getCancellationRequests(admin));
    }
    if (action === "update-report") {
      return updateReport(
        admin,
        body?.reportId,
        body?.status,
        body?.source,
        currentAdmin.id,
      );
    }
    if (action === "consumer-right-requests") {
      return json(await getConsumerRightRequests(admin));
    }
    if (action === "update-consumer-right-request") {
      return updateConsumerRightRequest(admin, body?.requestId, body?.status);
    }
    if (action === "urgency-policy") {
      return json(await getUrgencyPolicy(admin));
    }
    if (action === "update-urgency-policy") {
      return updateUrgencyPolicy(admin, body, currentAdmin.id);
    }
    if (action === "notification-health") {
      return json(await getNotificationHealth(admin));
    }
    if (action === "resolve-cancellation") {
      return resolveCancellation(
        admin,
        body?.requestId,
        body?.decision,
        body?.resolutionNote,
        currentAdmin.id,
      );
    }

    return json({ error: "Acción no permitida." }, 400);
  } catch (error) {
    console.error("[operational-dashboard]", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el panel.",
      },
      500,
    );
  }
});
