import { createClient } from "npm:@supabase/supabase-js@2";

const HANDOFF_PREFIX = "__TOORI_MICA_HANDOFF_V1__:";
const QUOTE_PREFIX = "__TOORI_QUOTE__";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BudgetRow = {
  id: number | string;
  monto: number | string | null;
  trabajador_uuid: string | null;
  horarios_disponibles: string | null;
  descripcion: string | null;
  estado: string | null;
  estado_confirmacion: string | null;
  metadata: Record<string, unknown> | null;
};

type UserProfileRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  foto_perfil: string | null;
  ranking: number | string | null;
  verificado: boolean | null;
};

type MarketplaceProfileRow = {
  id: string;
  nombre: string | null;
  foto_url: string | null;
  verificado: boolean | null;
};

type RatingRow = {
  providerId: string;
  score: number | string | null;
};

type JobRow = {
  contratado_id: string;
  aceptado: boolean | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function normalizeAmount(value: number | string | null) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function hasExternalContact(value: unknown) {
  const text = String(value ?? "");
  return (
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text) ||
    /(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|instagram\.com|facebook\.com|messenger\.com)/i.test(text) ||
    /\b(?:whats?app|telegram|instagram|facebook|messenger)\b|(?:^|\s)@[a-z0-9_.]{3,}/i.test(text) ||
    /(?:\+?\d[\s().-]*){7,}/.test(text)
  );
}

function orderPhase(
  step: number,
  quoteCount: number,
  selectedBudgetId: unknown,
) {
  if (selectedBudgetId) return "selected";
  if (step >= 99) return "quotes";
  if (step >= 4 && quoteCount > 0) return "quotes";
  if (step >= 4) return "searching";
  return "submitted";
}

async function getUser(req: Request, admin: ReturnType<typeof createClient>) {
  const token = getBearerToken(req);
  if (!token) return null;
  const {
    data: { user },
  } = await admin.auth.getUser(token);
  return user ?? null;
}

async function loadOwnedOffer(
  admin: ReturnType<typeof createClient>,
  userId: string,
  offerId?: string,
) {
  let query = admin
    .from("nuevaOferta")
    .select(
      "id,app_cliente_id,categoria,zona,descripcion,estado,paso,presupuesto_seleccionado_id,app_chat_id,created_at",
    )
    .eq("app_cliente_id", userId);

  if (offerId) {
    query = query.eq("id", offerId);
  } else {
    query = query
      .eq("source", "mica_app")
      .not("estado", "in", '("cancelado","cancelada","finalizada")')
      .order("created_at", { ascending: false })
      .limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function loadQuotes(
  admin: ReturnType<typeof createClient>,
  offerId: string,
  selectedBudgetId?: string | number | null,
) {
  const { data: budgetRows, error } = await admin
    .from("presupuestos")
    .select(
      "id,monto,trabajador_uuid,horarios_disponibles,descripcion,estado,estado_confirmacion,metadata",
    )
    .eq("oferta_id", offerId)
    .not("trabajador_uuid", "is", null)
    .not("estado", "in", '("rechazado","cancelado","cancelada")')
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) throw error;
  const budgets = (budgetRows ?? []) as BudgetRow[];
  const workerIds = [
    ...new Set(
      budgets
        .map((budget) => budget.trabajador_uuid)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (workerIds.length === 0) return [];

  const [profilesResult, marketplaceProfilesResult, ratingsResult, jobsResult] =
    await Promise.all([
      admin
        .from("usuarios")
        .select("id,nombre,apellido,foto_perfil,ranking,verificado")
        .in("id", workerIds),
      admin
        .from("sy_perfiles")
        .select("id,nombre,foto_url,verificado")
        .in("id", workerIds),
      admin
        .from("Rating")
        .select("providerId,score")
        .in("providerId", workerIds),
      admin
        .from("servicios_contratados")
        .select("contratado_id,aceptado")
        .in("contratado_id", workerIds),
    ]);

  const profiles = (profilesResult.data ?? []) as UserProfileRow[];
  const marketplaceProfiles = (marketplaceProfilesResult.data ??
    []) as MarketplaceProfileRow[];
  const ratings = (ratingsResult.data ?? []) as RatingRow[];
  const jobs = (jobsResult.data ?? []) as JobRow[];

  return budgets.map((budget) => {
    const metadata =
      budget.metadata && typeof budget.metadata === "object"
        ? budget.metadata
        : {};
    const workerId = budget.trabajador_uuid as string;
    const profile = profiles.find((item) => item.id === workerId);
    const marketplaceProfile = marketplaceProfiles.find(
      (item) => item.id === workerId,
    );
    const workerRatings = ratings
      .filter((item) => item.providerId === workerId)
      .map((item) => Number(item.score))
      .filter(Number.isFinite);
    const storedRating = Number(profile?.ranking);
    const rating =
      workerRatings.length > 0
        ? workerRatings.reduce((total, score) => total + score, 0) /
          workerRatings.length
        : Number.isFinite(storedRating) && storedRating > 0
          ? storedRating
          : null;

    return {
      id: String(budget.id),
      workerId,
      name:
        [profile?.nombre, profile?.apellido].filter(Boolean).join(" ").trim() ||
        marketplaceProfile?.nombre ||
        "Profesional de TOORI",
      amount: normalizeAmount(budget.monto),
      rating: rating ? Math.round(rating * 10) / 10 : null,
      jobs: jobs.filter(
        (item) => item.contratado_id === workerId && item.aceptado !== false,
      ).length,
      availability:
        budget.horarios_disponibles?.trim() || "Disponibilidad a coordinar",
      description:
        budget.descripcion?.trim() || "Presupuesto enviado desde la app",
      materials: String(metadata.materials ?? "A confirmar"),
      warranty: String(metadata.warranty ?? "7 días"),
      validUntil: String(metadata.validUntil ?? "24 horas"),
      notes: metadata.notes ? String(metadata.notes) : undefined,
      verified: Boolean(profile?.verificado || marketplaceProfile?.verificado),
      avatar: profile?.foto_perfil || marketplaceProfile?.foto_url || null,
      selected: String(selectedBudgetId ?? "") === String(budget.id),
    };
  });
}

async function findOrCreateChat(
  admin: ReturnType<typeof createClient>,
  clientId: string,
  providerId: string,
) {
  const [participantA, participantB] = [clientId, providerId].sort();
  const existing = await admin
    .from("chats")
    .select("id,participant_a,participant_b")
    .eq("participant_a", participantA)
    .eq("participant_b", participantB)
    .maybeSingle();

  if (existing.data) return existing.data;

  const inserted = await admin
    .from("chats")
    .insert({ participant_a: participantA, participant_b: participantB })
    .select("id,participant_a,participant_b")
    .single();

  if (!inserted.error && inserted.data) return inserted.data;

  const retry = await admin
    .from("chats")
    .select("id,participant_a,participant_b")
    .eq("participant_a", participantA)
    .eq("participant_b", participantB)
    .single();
  if (retry.error || !retry.data) throw inserted.error ?? retry.error;
  return retry.data;
}

async function notifyClientAboutBudget(
  admin: ReturnType<typeof createClient>,
  clientId: string | null,
  offerId: string,
) {
  if (!clientId) return;

  const { data: client } = await admin
    .from("usuarios")
    .select("expo_token")
    .eq("id", clientId)
    .maybeSingle();
  if (!client?.expo_token) return;

  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(expoAccessToken
        ? { Authorization: `Bearer ${expoAccessToken}` }
        : {}),
    },
    body: JSON.stringify({
      to: client.expo_token,
      sound: "default",
      title: "Nuevo presupuesto en MICA",
      body: "Un prestador respondió tu pedido. Entrá para comparar la propuesta.",
      data: {
        screen: "MicaChat",
        params: { mode: "buscar-servicio", offerId },
      },
    }),
  }).catch((error) => {
    console.error("[mica-order] push failed", error);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Supabase no está configurado." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const user = await getUser(req, admin);
    if (!user) return json({ error: "Sesión requerida." }, 401);

    const body = await req.json();
    const action = String(body?.action ?? "");
    const offerId = body?.offerId ? String(body.offerId) : undefined;

    if (action === "respond") {
      if (!offerId) {
        return json({ error: "Falta identificar el pedido." }, 400);
      }

      const { data: offer, error: offerError } = await admin
        .from("nuevaOferta")
        .select("id,app_cliente_id,estado,paso")
        .eq("id", offerId)
        .maybeSingle();
      if (offerError) throw offerError;
      if (!offer) return json({ error: "Pedido no encontrado." }, 404);
      if (offer.app_cliente_id === user.id) {
        return json(
          { error: "No podés responder tu propio pedido como prestador." },
          403,
        );
      }
      if (
        ["cancelado", "cancelada", "finalizada"].includes(
          String(offer.estado ?? "").toLowerCase(),
        )
      ) {
        return json({ error: "El pedido ya no está disponible." }, 409);
      }

      const { data: appProfile } = await admin
        .from("usuarios")
        .select("id,rol")
        .eq("id", user.id)
        .maybeSingle();
      const { data: marketplaceProfile } = await admin
        .from("sy_perfiles")
        .select("id,rol")
        .eq("id", user.id)
        .maybeSingle();
      const isWorker =
        String(appProfile?.rol ?? "").toLowerCase() === "worker" ||
        String(marketplaceProfile?.rol ?? "").toLowerCase() === "prestador";
      if (!isWorker) {
        return json(
          { error: "Necesitás un perfil de prestador para responder." },
          403,
        );
      }

      const response = body?.response ?? {};
      const responseType = String(response?.type ?? "");
      const isDecline = responseType === "decline";
      const amount = normalizeAmount(response?.amount ?? null);
      if (!isDecline && (responseType !== "budget" || amount <= 0)) {
        return json({ error: "El monto debe ser mayor a cero." }, 400);
      }
      const protectedDetails = [
        response?.availability,
        response?.description,
        response?.materials,
        response?.warranty,
        response?.validUntil,
        response?.notes,
      ].join(" ");
      if (!isDecline && hasExternalContact(protectedDetails)) {
        return json(
          { error: "El presupuesto no puede incluir teléfonos, emails, enlaces ni redes sociales." },
          400,
        );
      }

      const { data: existingBudget, error: existingBudgetError } = await admin
        .from("presupuestos")
        .select("id")
        .eq("oferta_id", offer.id)
        .eq("trabajador_uuid", user.id)
        .limit(1)
        .maybeSingle();
      if (existingBudgetError) throw existingBudgetError;

      const budgetPayload = {
        oferta_id: offer.id,
        trabajador_uuid: user.id,
        monto: isDecline ? 0 : amount,
        horarios_disponibles: isDecline
          ? null
          : String(response?.availability ?? "").trim() || null,
        descripcion: isDecline
          ? "Prestador no disponible"
          : String(response?.description ?? "").trim() ||
            "Presupuesto enviado desde la app TOORI",
        metadata: isDecline
          ? { source: "mica_app" }
          : {
              source: "mica_app",
              materials: String(response?.materials ?? "A confirmar").trim(),
              warranty: String(response?.warranty ?? "7 días").trim(),
              validUntil: String(response?.validUntil ?? "24 horas").trim(),
              notes: String(response?.notes ?? "").trim() || null,
            },
        estado: isDecline ? "rechazado" : "activo",
        estado_confirmacion: isDecline ? "rechazado" : "pendiente",
      };

      const budgetResult = existingBudget
        ? await admin
            .from("presupuestos")
            .update(budgetPayload)
            .eq("id", existingBudget.id)
            .select("id")
            .single()
        : await admin
            .from("presupuestos")
            .insert(budgetPayload)
            .select("id")
            .single();
      if (budgetResult.error || !budgetResult.data) {
        throw (
          budgetResult.error ?? new Error("No se pudo guardar la respuesta.")
        );
      }

      if (!isDecline && Number(offer.paso ?? 0) < 4) {
        const { error: updateOfferError } = await admin
          .from("nuevaOferta")
          .update({
            paso: 4,
            estado: "completa",
            updated_at: new Date().toISOString(),
          })
          .eq("id", offer.id);
        if (updateOfferError) throw updateOfferError;
      }

      if (!isDecline) {
        await notifyClientAboutBudget(
          admin,
          offer.app_cliente_id,
          String(offer.id),
        );
      }

      return json({
        ok: true,
        action: isDecline ? "declined" : existingBudget ? "updated" : "created",
        budgetId: String(budgetResult.data.id),
      });
    }

    if (action === "status") {
      const offer = await loadOwnedOffer(admin, user.id, offerId);
      if (!offer) return json({ order: null, quotes: [] });

      const quotes = await loadQuotes(
        admin,
        String(offer.id),
        offer.presupuesto_seleccionado_id,
      );
      const step = Number(offer.paso ?? 1);
      return json({
        order: {
          id: String(offer.id),
          phase: orderPhase(
            step,
            quotes.length,
            offer.presupuesto_seleccionado_id,
          ),
          status: offer.estado ?? "",
          step,
          category: offer.categoria ?? "Servicio",
          zone: offer.zona ?? "Zona a coordinar",
          description: offer.descripcion ?? "",
          selectedBudgetId: offer.presupuesto_seleccionado_id
            ? String(offer.presupuesto_seleccionado_id)
            : null,
          chatId: offer.app_chat_id ?? null,
        },
        quotes,
      });
    }

    if (action === "select") {
      const budgetId = String(body?.budgetId ?? "");
      if (!offerId || !budgetId) {
        return json(
          { error: "Falta identificar el pedido o presupuesto." },
          400,
        );
      }

      const offer = await loadOwnedOffer(admin, user.id, offerId);
      if (!offer) return json({ error: "Pedido no encontrado." }, 404);

      const quotes = await loadQuotes(
        admin,
        String(offer.id),
        offer.presupuesto_seleccionado_id,
      );
      const quote = quotes.find((item) => item.id === budgetId);
      if (!quote) {
        return json({ error: "El presupuesto ya no está disponible." }, 404);
      }

      const chat = await findOrCreateChat(admin, user.id, quote.workerId);
      const commission = Math.round(quote.amount * 0.1 * 100) / 100;
      const now = new Date().toISOString();

      const { error: offerUpdateError } = await admin
        .from("nuevaOferta")
        .update({
          presupuesto_seleccionado_id: Number(quote.id),
          monto_final: quote.amount,
          comision: commission,
          paso: 995,
          estado: "completa",
          app_chat_id: chat.id,
          updated_at: now,
        })
        .eq("id", offer.id)
        .eq("app_cliente_id", user.id);
      if (offerUpdateError) throw offerUpdateError;

      const { error: budgetUpdateError } = await admin
        .from("presupuestos")
        .update({
          estado_confirmacion: "seleccionado",
          cliente_id: user.id,
          app_chat_id: chat.id,
        })
        .eq("id", quote.id)
        .eq("oferta_id", offer.id);
      if (budgetUpdateError) throw budgetUpdateError;

      const quoteContent = `${QUOTE_PREFIX}${JSON.stringify({
        type: "quote",
        amount: quote.amount,
        scope: quote.description,
        materials: quote.materials,
        timeframe: quote.availability,
        warranty: quote.warranty,
        validUntil: quote.validUntil,
        notes: quote.notes,
        source: "mica",
        sourceBudgetId: quote.id,
        createdAt: now,
      })}`;
      const existingQuoteMessages = await admin
        .from("mensajes")
        .select("id,contenido")
        .eq("chat_id", chat.id)
        .eq("remitente_id", quote.workerId)
        .order("created_at", { ascending: false })
        .limit(50);
      let quoteMessageId = existingQuoteMessages.data?.find((message: { id: string; contenido: string | null }) =>
        String(message.contenido ?? "").includes(`\"sourceBudgetId\":\"${quote.id}\"`),
      )?.id;
      if (!quoteMessageId) {
        const insertedQuote = await admin.from("mensajes").insert({
          chat_id: chat.id,
          remitente_id: quote.workerId,
          contenido: quoteContent,
        }).select("id").single();
        if (insertedQuote.error || !insertedQuote.data) throw insertedQuote.error;
        quoteMessageId = insertedQuote.data.id;
      }

      const handoffText = [
        `Pedido: ${offer.categoria ?? "Servicio"}`,
        offer.descripcion ? `Detalle: ${offer.descripcion}` : null,
        offer.zona ? `Zona: ${offer.zona}` : null,
        `Profesional elegido: ${quote.name}`,
        `Presupuesto: $${Math.round(quote.amount).toLocaleString("es-AR")}`,
        `Disponibilidad: ${quote.availability}`,
        "Próximo paso: coordinar fecha, alcance y confirmación dentro de este chat.",
      ]
        .filter(Boolean)
        .join("\n");
      const handoffContent = `${HANDOFF_PREFIX}${JSON.stringify({
        kind: "handoff",
        title: "MICA conectó este servicio",
        text: handoffText,
        offerId: String(offer.id),
        budgetId: quote.id,
      })}`;

      const existingSummary = await admin
        .from("mensajes")
        .select("id")
        .eq("chat_id", chat.id)
        .eq("contenido", handoffContent)
        .limit(1)
        .maybeSingle();

      if (!existingSummary.data) {
        const { error: messageError } = await admin.from("mensajes").insert({
          chat_id: chat.id,
          remitente_id: user.id,
          contenido: handoffContent,
        });
        if (messageError) throw messageError;
      }

      await admin.from("chats").update({ updated_at: now }).eq("id", chat.id);

      return json({
        chat: {
          id: chat.id,
          participantA: chat.participant_a,
          participantB: chat.participant_b,
          providerId: quote.workerId,
          providerName: quote.name,
        },
        quote: { ...quote, selected: true },
        quoteMessageId,
      });
    }

    return json({ error: "Acción no válida." }, 400);
  } catch (error) {
    console.error("[mica-order]", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado.",
      },
      500,
    );
  }
});
