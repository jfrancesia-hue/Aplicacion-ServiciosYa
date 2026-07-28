import { supabase } from "./supabase";

export type ProviderAvailabilityStatus =
  | "online"
  | "scheduled"
  | "busy"
  | "to_confirm";

export type AvailableProvider = {
  id: string;
  nombre: string;
  edad?: number | null;
  foto_perfil?: string | null;
  provincia?: string | null;
  ciudad?: string | null;
  barrio?: string | null;
  categoria: string[];
  matricula?: unknown;
  antecedentes?: unknown;
  verificado?: boolean;
  suscriptor?: boolean;
  antiguedad?: number | null;
  availabilityStatus: ProviderAvailabilityStatus;
  availabilityLabel: string;
  availabilityDetail?: string | null;
  availabilityUpdatedAt?: string | null;
  legacy: boolean;
  campaignProfile: boolean;
  serviceCount: number;
};

export type AvailableProviderLocation = {
  city?: string | null;
  province?: string | null;
  locality?: string | null;
};

type ProviderListResponse = {
  ok?: boolean;
  providers?: AvailableProvider[];
  meta?: {
    category?: string;
    providersInScope?: number;
    legacyIncluded?: number;
    campaignIncluded?: number;
    unlinkedCampaignProfiles?: number;
  };
  error?: string;
};

type ProviderCountsResponse = {
  ok?: boolean;
  counts?: Record<string, number>;
  error?: string;
};

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

function normalizeCategory(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function providerCategoryKey(value?: string | null) {
  const normalized = normalizeCategory(value);
  if (!normalized) return "";

  for (const group of CATEGORY_KEYS) {
    if (group.signals.some((signal) => normalized.includes(signal))) {
      return group.key;
    }
  }

  return normalized;
}

export async function getAvailableProviders(
  category: string,
  location?: AvailableProviderLocation | null,
) {
  const { data, error } = await supabase.functions.invoke<ProviderListResponse>(
    "available-providers",
    {
      body: {
        action: "list",
        category,
        city: location?.city ?? null,
        province: location?.province ?? null,
        locality: location?.locality ?? null,
      },
    },
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return {
    providers: data?.providers ?? [],
    meta: data?.meta ?? {},
  };
}

export async function getAvailableProviderCounts(
  location?: AvailableProviderLocation | null,
) {
  const { data, error } =
    await supabase.functions.invoke<ProviderCountsResponse>(
      "available-providers",
      {
        body: {
          action: "counts",
          city: location?.city ?? null,
          province: location?.province ?? null,
          locality: location?.locality ?? null,
        },
      },
    );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.counts ?? {};
}
