import Constants from "expo-constants";
import { supabase } from "./supabase";

export type SyncPrestadorInput = {
  appUserId: string;
  nombre: string;
  telefono: string;
  email?: string | null;
  oficios?: string[];
  ciudad?: string | null;
  provincia?: string | null;
  barrio?: string | null;
  verificado?: boolean;
};

export type PedidoMica = {
  id: string | number;
  categoria: string;
  zona: string;
  descripcion: string;
  estado: string;
  paso: number;
  createdAt?: string | null;
  mediaUrl?: string | null;
  videoUrls?: string | null;
  presupuestoEstimado?: number | string | null;
  yaRespondio?: boolean;
};

export type PedidosDisponiblesInput = {
  appUserId: string;
  telefono?: string | null;
  oficios: string[];
  ciudad?: string | null;
  provincia?: string | null;
  limit?: number;
};

export type ResponderPedidoInput = {
  ofertaId: string | number;
  appUserId: string;
  nombre?: string | null;
  telefono?: string | null;
  accion: "presupuesto" | "no_disponible";
  monto?: number;
  horariosDisponibles?: string | null;
  descripcion?: string | null;
};

export type EstadoPedidoMicaInput = {
  ofertaId: string | number;
  appUserId?: string;
};

export type ServiciosYaApiResult<T> =
  | {
      ok: true;
      skipped?: false;
      data: T;
      raw?: unknown;
    }
  | {
      ok: false;
      skipped?: boolean;
      error: string;
      raw?: unknown;
    };

export type SyncPrestadorResult = ServiciosYaApiResult<{
  action?: "created" | "updated";
  marketplaceId?: string;
}>;

function getExtraValue(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getEnvValue(key: string): string | undefined {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getServiciosYaApiConfig() {
  const baseUrl =
    getEnvValue("EXPO_PUBLIC_SERVICIOSYA_SYNC_BASE_URL") ??
    getExtraValue("serviciosYaSyncBaseUrl");
  const sharedToken =
    getEnvValue("EXPO_PUBLIC_SERVICIOSYA_APP_SYNC_TOKEN") ??
    getExtraValue("serviciosYaAppSyncToken");
  return { baseUrl, sharedToken };
}

function getEndpoint(path: string): ServiciosYaApiResult<{ endpoint: string }> {
  const { baseUrl } = getServiciosYaApiConfig();

  if (!baseUrl) {
    return {
      ok: false,
      skipped: true,
      error:
        "Sync ServiciosYa no configurado: falta extra.serviciosYaSyncBaseUrl o EXPO_PUBLIC_SERVICIOSYA_SYNC_BASE_URL",
    };
  }

  return {
    ok: true,
    data: {
      endpoint: `${baseUrl.replace(/\/$/, "")}${path}`,
    },
  };
}

async function getAuthorizationToken(): Promise<string | undefined> {
  const { sharedToken } = getServiciosYaApiConfig();
  if (sharedToken) return sharedToken;

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

async function requestServiciosYa<T>(
  path: string,
  options: RequestInit,
  errorLabel: string,
): Promise<ServiciosYaApiResult<T>> {
  const config = getEndpoint(path);
  if (!config.ok) return config;

  const token = await getAuthorizationToken();
  if (!token) {
    return {
      ok: false,
      error: "No hay sesión activa para conectar con ServiciosYa/Mica",
    };
  }

  try {
    const response = await fetch(config.data.endpoint, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload: unknown = contentType.includes("application/json") ? await response.json() : await response.text();
    const jsonPayload = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : null;

    if (!response.ok || jsonPayload?.ok !== true) {
      return {
        ok: false,
        error: typeof jsonPayload?.error === "string" ? jsonPayload.error : `Error HTTP ${response.status} ${errorLabel}`,
        raw: payload,
      };
    }

    return {
      ok: true,
      data: jsonPayload as T,
      raw: payload,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Error desconocido ${errorLabel}`,
    };
  }
}

function postServiciosYa<T>(
  path: string,
  body: unknown,
  errorLabel: string,
): Promise<ServiciosYaApiResult<T>> {
  return requestServiciosYa<T>(
    path,
    { method: "POST", body: JSON.stringify(body) },
    errorLabel,
  );
}

function getServiciosYa<T>(
  path: string,
  errorLabel: string,
): Promise<ServiciosYaApiResult<T>> {
  return requestServiciosYa<T>(path, { method: "GET" }, errorLabel);
}

export async function syncPrestadorConServiciosYa(
  input: SyncPrestadorInput,
): Promise<SyncPrestadorResult> {
  const result = await postServiciosYa<Record<string, unknown>>(
    "/api/app/sync-prestador.php",
    input,
    "sincronizando prestador",
  );

  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      action: result.data.action === "created" || result.data.action === "updated" ? result.data.action : undefined,
      marketplaceId: typeof result.data.marketplaceId === "string" ? result.data.marketplaceId : undefined,
    },
    raw: result.raw,
  };
}

export async function obtenerPedidosDisponibles(
  input: PedidosDisponiblesInput,
): Promise<ServiciosYaApiResult<{ pedidos: PedidoMica[]; count: number }>> {
  const result = await postServiciosYa<Record<string, unknown>>(
    "/api/app/pedidos-disponibles.php",
    input,
    "obteniendo pedidos disponibles",
  );

  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      pedidos: Array.isArray(result.data.pedidos) ? (result.data.pedidos as PedidoMica[]) : [],
      count: typeof result.data.count === "number" ? result.data.count : 0,
    },
    raw: result.raw,
  };
}

export async function responderPedidoMica(
  input: ResponderPedidoInput,
): Promise<
  ServiciosYaApiResult<{
    action?: string;
    ofertaId?: string;
    presupuesto?: unknown;
  }>
> {
  const result = await postServiciosYa<Record<string, unknown>>(
    "/api/app/responder-pedido.php",
    input,
    "respondiendo pedido",
  );

  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      action: typeof result.data.action === "string" ? result.data.action : undefined,
      ofertaId: typeof result.data.ofertaId === "string" ? result.data.ofertaId : undefined,
      presupuesto: result.data.presupuesto,
    },
    raw: result.raw,
  };
}

export async function obtenerEstadoPedidoMica(
  input: EstadoPedidoMicaInput,
): Promise<
  ServiciosYaApiResult<{
    pedido?: unknown;
    presupuestos?: unknown[];
    outreach?: unknown;
  }>
> {
  const params = new URLSearchParams({ ofertaId: String(input.ofertaId) });
  if (input.appUserId) params.set("appUserId", input.appUserId);

  const result = await getServiciosYa<Record<string, unknown>>(
    `/api/app/estado-pedido.php?${params.toString()}`,
    "obteniendo estado del pedido",
  );

  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      pedido: result.data.pedido,
      presupuestos: Array.isArray(result.data.presupuestos) ? result.data.presupuestos : [],
      outreach: result.data.outreach,
    },
    raw: result.raw,
  };
}
