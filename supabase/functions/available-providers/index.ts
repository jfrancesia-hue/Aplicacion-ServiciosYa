import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CACHE_TTL_MS = 2 * 60 * 1000;
const RECENT_AVAILABILITY_MS = 30 * 60 * 1000;

type UserRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  edad: number | null;
  foto_perfil: string | null;
  ciudad: string | null;
  provincia: string | null;
  barrio: string | null;
  rol: string | null;
  categoria: string[] | string | null;
  horarios: string | null;
  celular: string | number | null;
  matricula: unknown;
  verificado: boolean | null;
  suscriptor: boolean | null;
  antiguedad: number | null;
  perfilPublico: boolean | null;
};

type ServiceRow = {
  id: number | string;
  user_id: string | null;
  usuario_id: string | null;
  categoria: string | null;
  estado: string | null;
  ciudad: string | null;
  barrio: string | null;
  horario: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

type WorkerStateRow = {
  user_id: string;
  status: string | null;
  last_seen_at: string | null;
  available_until: string | null;
  availability_duration_hours: number | null;
};

type CampaignProfileRow = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  zona_frecuente: string | null;
  oficios: string[] | string | null;
  rol: string | null;
  foto_url: string | null;
  matricula_url: string | null;
  verificado: boolean | null;
  antiguedad: number | null;
  edad: number | null;
};

type CityRow = {
  name: string;
  state_code: string;
  latitude: number;
  longitude: number;
};

type ProviderTrustRow = {
  provider_id: string;
  completed_jobs: number | null;
  average_rating: number | null;
  review_count: number | null;
  average_response_minutes: number | null;
  response_sample_size: number | null;
};

type CachedData = {
  users: UserRow[];
  services: ServiceRow[];
  workerStates: WorkerStateRow[];
  campaignProfiles: CampaignProfileRow[];
  argentinaCities: CityRow[];
  providerTrust: ProviderTrustRow[];
  expiresAt: number;
};

type LocationInput = {
  city?: string | null;
  province?: string | null;
  locality?: string | null;
};

type RequestBody = LocationInput & {
  action?: "list" | "counts";
  category?: string | null;
};

type Availability = {
  status: "online" | "scheduled" | "busy" | "to_confirm";
  label: string;
  detail: string | null;
  rank: number;
  updatedAt: string | null;
};

type ProviderDraft = {
  id: string;
  user: UserRow;
  services: ServiceRow[];
  campaignProfiles: CampaignProfileRow[];
  categories: Set<string>;
  sources: Set<"current_profile" | "published_service" | "campaign">;
};

let cachedData: CachedData | null = null;
let cachedProviderIndex: {
  source: CachedData;
  value: ReturnType<typeof buildProviders>;
} | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=30",
    },
  });
}

function bearerToken(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
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

function cleanText(value?: string | null) {
  return String(value ?? "").trim();
}

function parseCategories(value: string[] | string | null | undefined) {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [parsed];
    }
  }

  const values = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  return Array.from(
    new Set(values.map((item) => cleanText(String(item))).filter(Boolean)),
  );
}

const CATEGORY_KEYS = [
  { key: "plomeria", signals: ["plom"] },
  { key: "electricidad", signals: ["electric"] },
  { key: "albanileria", signals: ["alban"] },
  { key: "pintura", signals: ["pintor", "pintura"] },
  { key: "limpieza", signals: ["limpieza", "domestica"] },
  { key: "carpinteria", signals: ["carpinter"] },
  { key: "cerrajeria", signals: ["cerrajer"] },
  { key: "jardineria", signals: ["jardiner"] },
  { key: "mecanica", signals: ["mecanic"] },
  { key: "gasista", signals: ["gasista"] },
  { key: "refrigeracion", signals: ["refriger", "aire acondicionado"] },
] as const;

function categoryKey(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  for (const group of CATEGORY_KEYS) {
    if (group.signals.some((signal) => normalized.includes(signal))) {
      return group.key;
    }
  }

  return normalized;
}

function categoriesMatch(candidate?: string | null, target?: string | null) {
  const candidateKey = categoryKey(candidate);
  const targetKey = categoryKey(target);
  if (!candidateKey || !targetKey) return false;

  return (
    candidateKey === targetKey ||
    candidateKey.includes(targetKey) ||
    targetKey.includes(candidateKey)
  );
}

const ARGENTINE_PROVINCES = [
  {
    name: "Ciudad Autónoma de Buenos Aires",
    aliases: [
      "caba",
      "capital federal",
      "ciudad autonoma de buenos aires",
      "buenos aires ciudad",
    ],
  },
  {
    name: "Buenos Aires",
    aliases: ["provincia de buenos aires", "buenos aires", "la plata"],
  },
  {
    name: "Catamarca",
    aliases: [
      "catamarca",
      "san fernando del valle de catamarca",
      "san fernando de catamarca",
      "valle viejo",
    ],
  },
  { name: "Chaco", aliases: ["chaco", "resistencia"] },
  { name: "Chubut", aliases: ["chubut", "rawson"] },
  { name: "Córdoba", aliases: ["cordoba"] },
  { name: "Corrientes", aliases: ["corrientes"] },
  { name: "Entre Ríos", aliases: ["entre rios", "parana"] },
  { name: "Formosa", aliases: ["formosa"] },
  { name: "Jujuy", aliases: ["jujuy", "san salvador de jujuy"] },
  { name: "La Pampa", aliases: ["la pampa", "santa rosa"] },
  { name: "La Rioja", aliases: ["la rioja"] },
  { name: "Mendoza", aliases: ["mendoza"] },
  { name: "Misiones", aliases: ["misiones", "posadas"] },
  { name: "Neuquén", aliases: ["neuquen"] },
  { name: "Río Negro", aliases: ["rio negro", "viedma"] },
  { name: "Salta", aliases: ["salta"] },
  { name: "San Juan", aliases: ["san juan"] },
  { name: "San Luis", aliases: ["san luis"] },
  { name: "Santa Cruz", aliases: ["santa cruz", "rio gallegos"] },
  { name: "Santa Fe", aliases: ["santa fe"] },
  { name: "Santiago del Estero", aliases: ["santiago del estero"] },
  {
    name: "Tierra del Fuego",
    aliases: ["tierra del fuego", "ushuaia"],
  },
  {
    name: "Tucumán",
    aliases: ["tucuman", "san miguel de tucuman", "monteros"],
  },
] as const;

const ARGENTINE_PROVINCE_BY_STATE_CODE: Record<string, string> = {
  A: "Salta",
  B: "Buenos Aires",
  BA: "Buenos Aires",
  C: "Ciudad Autónoma de Buenos Aires",
  D: "San Luis",
  E: "Entre Ríos",
  F: "La Rioja",
  G: "Santiago del Estero",
  H: "Chaco",
  J: "San Juan",
  K: "Catamarca",
  L: "La Pampa",
  M: "Mendoza",
  N: "Misiones",
  P: "Formosa",
  Q: "Neuquén",
  R: "Río Negro",
  S: "Santa Fe",
  T: "Tucumán",
  U: "Chubut",
  V: "Tierra del Fuego",
  W: "Corrientes",
  X: "Córdoba",
  Y: "Jujuy",
  Z: "Santa Cruz",
};

function resolveProvince(value?: string | null) {
  const normalized = normalizeText(value)
    .replace(/\b(provincia|province|prov)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;

  for (const province of ARGENTINE_PROVINCES) {
    const aliases = province.aliases
      .map(normalizeText)
      .sort((a, b) => b.length - a.length);
    if (
      aliases.some(
        (alias) =>
          normalized === alias || ` ${normalized} `.includes(` ${alias} `),
      )
    ) {
      return province.name;
    }
  }

  return null;
}

function sameLocality(candidate?: string | null, target?: string | null) {
  const candidateNormalized = normalizeText(candidate);
  const targetNormalized = normalizeText(target);
  if (!candidateNormalized || !targetNormalized) return false;

  return (
    candidateNormalized === targetNormalized ||
    candidateNormalized.includes(targetNormalized) ||
    targetNormalized.includes(candidateNormalized)
  );
}

function normalizePhone(value?: string | number | null) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("549")) digits = digits.slice(3);
  else if (digits.startsWith("54")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function isActiveService(service: ServiceRow) {
  const state = normalizeText(service.estado).replace(/'/g, "");
  return !state || state === "activo";
}

async function fetchAll<T>(
  admin: ReturnType<typeof createClient>,
  table: string,
  select: string,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from(table)
      .select(select)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }

  return rows;
}

async function fetchArgentinaCities(admin: ReturnType<typeof createClient>) {
  const rows: CityRow[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("cities")
      .select("name,state_code,latitude,longitude")
      .eq("country_code", "AR")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as CityRow[]));
    if (!data || data.length < 1000) break;
  }

  return rows;
}

async function loadData(admin: ReturnType<typeof createClient>) {
  if (cachedData && cachedData.expiresAt > Date.now()) {
    return cachedData;
  }

  const [
    users,
    services,
    workerStates,
    campaignProfiles,
    argentinaCities,
    providerTrust,
  ] = await Promise.all([
    fetchAll<UserRow>(
      admin,
      "usuarios",
      "id,nombre,apellido,edad,foto_perfil,ciudad,provincia,barrio,rol,categoria,horarios,celular,matricula,verificado,suscriptor,antiguedad,perfilPublico",
    ),
    fetchAll<ServiceRow>(
      admin,
      "servicios_with_coords",
      "id,user_id,usuario_id,categoria,estado,ciudad,barrio,horario,country,latitude,longitude",
    ),
    fetchAll<WorkerStateRow>(
      admin,
      "workers",
      "user_id,status,last_seen_at,available_until,availability_duration_hours",
    ),
    fetchAll<CampaignProfileRow>(
      admin,
      "sy_perfiles",
      "id,nombre,telefono,zona_frecuente,oficios,rol,foto_url,matricula_url,verificado,antiguedad,edad",
    ),
    fetchArgentinaCities(admin),
    fetchAll<ProviderTrustRow>(
      admin,
      "provider_trust_summary",
      "provider_id,completed_jobs,average_rating,review_count,average_response_minutes,response_sample_size",
    ),
  ]);

  cachedData = {
    users,
    services,
    workerStates,
    campaignProfiles,
    argentinaCities,
    providerTrust,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  return cachedData;
}

function nearestArgentineCity(service: ServiceRow, cities: CityRow[]) {
  const latitude = Number(service.latitude);
  const longitude = Number(service.longitude);
  const country = normalizeText(service.country).toUpperCase();
  const isInsideArgentina =
    latitude >= -56 && latitude <= -21 && longitude >= -74 && longitude <= -53;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    (country && country !== "AR") ||
    !isInsideArgentina
  ) {
    return null;
  }

  const longitudeScale = Math.cos((latitude * Math.PI) / 180);
  let nearest: CityRow | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const city of cities) {
    const latitudeDifference = city.latitude - latitude;
    const longitudeDifference = (city.longitude - longitude) * longitudeScale;
    const distance =
      latitudeDifference * latitudeDifference +
      longitudeDifference * longitudeDifference;
    if (distance < nearestDistance) {
      nearest = city;
      nearestDistance = distance;
    }
  }

  if (!nearest) return null;
  const province =
    ARGENTINE_PROVINCE_BY_STATE_CODE[nearest.state_code.toUpperCase()];
  return province ? { city: cleanText(nearest.name), province } : null;
}

function availabilityFor(
  user: UserRow,
  services: ServiceRow[],
  state?: WorkerStateRow,
): Availability {
  const lastSeenAt = state?.last_seen_at
    ? new Date(state.last_seen_at).getTime()
    : Number.NaN;
  const isRecent =
    Number.isFinite(lastSeenAt) &&
    Date.now() - lastSeenAt <= RECENT_AVAILABILITY_MS;
  const availableUntil = state?.available_until
    ? new Date(state.available_until).getTime()
    : Number.NaN;
  const hasConfirmedWindow =
    Number.isFinite(availableUntil) && availableUntil > Date.now();

  if (
    state?.status === "ONLINE" &&
    (hasConfirmedWindow || (!state.available_until && isRecent))
  ) {
    const confirmedUntilDetail = hasConfirmedWindow
      ? `Confirmó disponibilidad hasta ${new Intl.DateTimeFormat("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Argentina/Buenos_Aires",
        }).format(new Date(availableUntil))}`
      : "Con actividad reciente en la app";
    return {
      status: "online",
      label: "Disponible ahora",
      detail: confirmedUntilDetail,
      rank: 0,
      updatedAt: state.available_until ?? state.last_seen_at,
    };
  }

  if (state?.status === "BUSY" && isRecent) {
    return {
      status: "busy",
      label: "Ocupado ahora",
      detail: "Podés consultar su próximo horario",
      rank: 3,
      updatedAt: state.last_seen_at,
    };
  }

  const schedule =
    services.map((service) => cleanText(service.horario)).find(Boolean) ||
    cleanText(user.horarios);
  if (schedule) {
    return {
      status: "scheduled",
      label: "Horario publicado",
      detail: schedule,
      rank: 1,
      updatedAt: state?.last_seen_at ?? null,
    };
  }

  return {
    status: "to_confirm",
    label: "Disponibilidad a confirmar",
    detail: "Consultá por el chat interno",
    rank: 2,
    updatedAt: state?.last_seen_at ?? null,
  };
}

function buildProviders(data: CachedData) {
  const usersById = new Map(data.users.map((user) => [user.id, user]));
  const phoneUsers = new Map<string, UserRow[]>();
  for (const user of data.users) {
    const phone = normalizePhone(user.celular);
    if (phone.length < 8) continue;
    phoneUsers.set(phone, [...(phoneUsers.get(phone) ?? []), user]);
  }

  const campaignByUser = new Map<string, CampaignProfileRow[]>();
  let unlinkedCampaignProfiles = 0;
  for (const profile of data.campaignProfiles) {
    if (["admin", "administrador"].includes(normalizeText(profile.rol))) {
      continue;
    }
    const byId = usersById.get(profile.id);
    const phoneMatches = phoneUsers.get(normalizePhone(profile.telefono)) ?? [];
    const linkedUser =
      byId ?? (phoneMatches.length === 1 ? phoneMatches[0] : null);
    if (!linkedUser) {
      unlinkedCampaignProfiles += 1;
      continue;
    }
    campaignByUser.set(linkedUser.id, [
      ...(campaignByUser.get(linkedUser.id) ?? []),
      profile,
    ]);
  }

  const servicesByUser = new Map<string, ServiceRow[]>();
  for (const service of data.services) {
    if (!isActiveService(service)) continue;
    const userId = [service.user_id, service.usuario_id]
      .map(cleanText)
      .find((candidateId) => usersById.has(candidateId));
    if (!userId) continue;
    servicesByUser.set(userId, [
      ...(servicesByUser.get(userId) ?? []),
      service,
    ]);
  }

  const drafts = new Map<string, ProviderDraft>();
  for (const user of data.users) {
    const services = servicesByUser.get(user.id) ?? [];
    const campaignProfiles = campaignByUser.get(user.id) ?? [];
    const currentCategories = parseCategories(user.categoria);
    const isCurrentPublicProvider =
      normalizeText(user.rol) === "worker" &&
      user.perfilPublico === true &&
      currentCategories.length > 0;
    if (
      !isCurrentPublicProvider &&
      services.length === 0 &&
      campaignProfiles.length === 0
    ) {
      continue;
    }

    const draft: ProviderDraft = {
      id: user.id,
      user,
      services,
      campaignProfiles,
      categories: new Set<string>(),
      sources: new Set(),
    };
    if (isCurrentPublicProvider) draft.sources.add("current_profile");
    if (services.length > 0) draft.sources.add("published_service");
    if (campaignProfiles.length > 0) draft.sources.add("campaign");

    for (const category of currentCategories) draft.categories.add(category);
    for (const service of services) {
      if (cleanText(service.categoria)) {
        draft.categories.add(cleanText(service.categoria));
      }
    }
    for (const profile of campaignProfiles) {
      for (const category of parseCategories(profile.oficios)) {
        draft.categories.add(category);
      }
    }
    drafts.set(user.id, draft);
  }

  const statesByUser = new Map(
    data.workerStates.map((state) => [state.user_id, state]),
  );
  const trustByUser = new Map(
    data.providerTrust.map((summary) => [summary.provider_id, summary]),
  );
  const serviceLocations = new Map(
    data.services.map((service) => [
      service.id,
      nearestArgentineCity(service, data.argentinaCities),
    ]),
  );

  const providers = Array.from(drafts.values()).map((draft) => {
    const campaign = draft.campaignProfiles[0];
    const serviceCity = draft.services
      .map((service) => cleanText(service.ciudad))
      .find(Boolean);
    const serviceDistrict = draft.services
      .map((service) => cleanText(service.barrio))
      .find(Boolean);
    const campaignZone = cleanText(campaign?.zona_frecuente);
    const coordinateLocation = draft.services
      .map((service) => serviceLocations.get(service.id))
      .find(Boolean);
    const province =
      cleanText(draft.user.provincia) ||
      resolveProvince(campaignZone) ||
      resolveProvince(serviceCity) ||
      coordinateLocation?.province ||
      null;
    const city =
      cleanText(draft.user.ciudad) ||
      (campaignZone ? campaignZone.split(",")[0]?.trim() : "") ||
      serviceCity ||
      coordinateLocation?.city ||
      null;
    const barrio = cleanText(draft.user.barrio) || serviceDistrict || null;
    const availability = availabilityFor(
      draft.user,
      draft.services,
      statesByUser.get(draft.id),
    );
    const legacy =
      normalizeText(draft.user.rol) !== "worker" ||
      draft.user.perfilPublico !== true ||
      parseCategories(draft.user.categoria).length === 0;
    const trust = trustByUser.get(draft.id);

    return {
      id: draft.id,
      nombre:
        [draft.user.nombre, draft.user.apellido]
          .map(cleanText)
          .filter(Boolean)
          .join(" ") ||
        cleanText(campaign?.nombre) ||
        "Prestador de ServiciosYa",
      edad: draft.user.edad ?? campaign?.edad ?? null,
      foto_perfil:
        cleanText(draft.user.foto_perfil) ||
        cleanText(campaign?.foto_url) ||
        null,
      provincia: province,
      ciudad: city,
      barrio,
      categoria: Array.from(draft.categories),
      // Los documentos de perfiles históricos no se exponen desde una
      // función con permisos administrativos. Solo conservamos los que el
      // propio usuario marcó como parte de un perfil público actual.
      credentialSubmitted: Boolean(
        draft.sources.has("current_profile") && draft.user.matricula,
      ),
      verificado: Boolean(draft.user.verificado || campaign?.verificado),
      suscriptor: Boolean(draft.user.suscriptor),
      antiguedad: draft.user.antiguedad ?? campaign?.antiguedad ?? null,
      availabilityStatus: availability.status,
      availabilityLabel: availability.label,
      availabilityDetail: availability.detail,
      availabilityUpdatedAt: availability.updatedAt,
      availabilityRank: availability.rank,
      legacy,
      sources: Array.from(draft.sources),
      serviceCount: draft.services.length,
      campaignProfile: draft.sources.has("campaign"),
      locationText: [barrio, city, province].filter(Boolean).join(", "),
      completedJobs: Number(trust?.completed_jobs ?? 0),
      averageRating:
        trust?.average_rating == null ? null : Number(trust.average_rating),
      reviewCount: Number(trust?.review_count ?? 0),
      averageResponseMinutes:
        trust?.average_response_minutes == null
          ? null
          : Number(trust.average_response_minutes),
      responseSampleSize: Number(trust?.response_sample_size ?? 0),
    };
  });

  return { providers, unlinkedCampaignProfiles };
}

function providerMatchesLocation(
  provider: {
    provincia?: string | null;
    ciudad?: string | null;
    barrio?: string | null;
    locationText?: string | null;
  },
  target: LocationInput,
) {
  const targetProvince =
    resolveProvince(target.province) ||
    resolveProvince(target.city) ||
    resolveProvince(target.locality);
  const targetCity = cleanText(target.city) || cleanText(target.locality);

  if (targetProvince) {
    const providerProvince =
      resolveProvince(provider.provincia) ||
      resolveProvince(provider.locationText) ||
      resolveProvince(provider.ciudad);
    return providerProvince === targetProvince;
  }

  if (targetCity) {
    return [provider.ciudad, provider.barrio].some((value) =>
      sameLocality(value, targetCity),
    );
  }

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Método no permitido" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Configuración incompleta" }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const action = body.action ?? "list";
    const category = cleanText(body.category).slice(0, 120);
    if (action === "list" && !category) {
      return json({ error: "Falta la categoría" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = bearerToken(req);
    const {
      data: { user },
    } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Sesión requerida" }, 401);

    const data = await loadData(admin);
    const providerIndex =
      cachedProviderIndex?.source === data
        ? cachedProviderIndex.value
        : buildProviders(data);
    cachedProviderIndex = { source: data, value: providerIndex };
    const { providers, unlinkedCampaignProfiles } = providerIndex;
    const scopedProviders = providers.filter((provider) =>
      providerMatchesLocation(provider, body),
    );

    if (action === "counts") {
      const countSets = new Map<string, Set<string>>();
      for (const provider of scopedProviders) {
        for (const categoryName of provider.categoria) {
          const key = categoryKey(categoryName);
          if (!key) continue;
          if (!countSets.has(key)) countSets.set(key, new Set());
          countSets.get(key)?.add(provider.id);
        }
      }

      return json({
        ok: true,
        counts: Object.fromEntries(
          Array.from(countSets.entries()).map(([key, ids]) => [key, ids.size]),
        ),
        meta: {
          providersInScope: scopedProviders.length,
          unlinkedCampaignProfiles,
        },
      });
    }

    const matchingProviders = scopedProviders
      .filter((provider) =>
        provider.categoria.some((candidate) =>
          categoriesMatch(candidate, category),
        ),
      )
      .sort((a, b) => {
        if (a.availabilityRank !== b.availabilityRank) {
          return a.availabilityRank - b.availabilityRank;
        }
        const targetCity = cleanText(body.city) || cleanText(body.locality);
        if (targetCity) {
          const cityDifference =
            Number(sameLocality(b.ciudad, targetCity)) -
            Number(sameLocality(a.ciudad, targetCity));
          if (cityDifference !== 0) return cityDifference;
        }
        return a.nombre.localeCompare(b.nombre, "es");
      })
      .slice(0, 300);

    return json({
      ok: true,
      providers: matchingProviders,
      meta: {
        category,
        providersInScope: scopedProviders.length,
        legacyIncluded: matchingProviders.filter((provider) => provider.legacy)
          .length,
        campaignIncluded: matchingProviders.filter(
          (provider) => provider.campaignProfile,
        ).length,
        unlinkedCampaignProfiles,
      },
    });
  } catch (error) {
    console.error("[available-providers]", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los prestadores",
      },
      500,
    );
  }
});
