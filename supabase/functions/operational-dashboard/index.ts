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
    paymentsResult,
    eventsResult,
    reviewsResult,
    providerLocationsResult,
    trustResult,
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
  ]);

  const failures = [
    providersResult.error,
    campaignResult.error,
    workerStatesResult.error,
    chatsResult.error,
    messagesResult.error,
    profileReportsResult.error,
    legacyReportsResult.error,
    paymentsResult.error,
    eventsResult.error,
    reviewsResult.error,
    providerLocationsResult.error,
    trustResult.error,
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
        (profileReportsResult.count ?? 0) + (legacyReportsResult.count ?? 0),
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
  const [profileResult, legacyResult] = await Promise.all([
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
  ]);
  if (profileResult.error) throw profileResult.error;
  if (legacyResult.error) throw legacyResult.error;

  const profileReports = (profileResult.data ?? []) as ReportRow[];
  const legacyReports = (legacyResult.data ?? []) as LegacyReportRow[];
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
) {
  const cleanId = String(reportId ?? "").trim();
  const cleanStatus = String(status ?? "").trim();
  const table = source === "service" ? "reports" : "profile_reports";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      cleanId,
    ) ||
    !REPORT_STATUSES.has(cleanStatus)
  ) {
    return json({ error: "Datos de moderación inválidos." }, 400);
  }

  const { data, error } = await admin
    .from(table)
    .update({ status: cleanStatus })
    .eq("id", cleanId)
    .select("id,status")
    .maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: "Reporte no encontrado." }, 404);

  return json({ ok: true, report: data });
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
    if (action === "update-report") {
      return updateReport(admin, body?.reportId, body?.status, body?.source);
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
