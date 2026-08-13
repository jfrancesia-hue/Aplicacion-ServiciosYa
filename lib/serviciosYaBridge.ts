import Constants from "expo-constants";
import type {
  ServiciosYaBridgePedidoResponse,
  ServiciosYaBridgeResponderPedidoPayload,
  ServiciosYaBridgeResponse,
  ServiciosYaBridgeSyncPrestadorPayload,
} from "../types/serviciosYaBridge";
import { supabase } from "./supabase";

type ServiciosYaBridgeExtra = {
  serviciosYaBridge?: {
    baseUrl?: string;
    syncToken?: string;
  };
};

const extra = (Constants.expoConfig?.extra ?? {}) as ServiciosYaBridgeExtra;

const DEFAULT_BASE_URL = "https://tooriserviciosya.com/api/app";

export const SERVICIOSYA_BRIDGE_BASE_URL =
  process.env.EXPO_PUBLIC_SERVICIOSYA_APP_API_BASE_URL ||
  extra.serviciosYaBridge?.baseUrl ||
  DEFAULT_BASE_URL;

const SERVICIOSYA_BRIDGE_TOKEN =
  process.env.EXPO_PUBLIC_SERVICIOSYA_APP_SYNC_TOKEN ||
  extra.serviciosYaBridge?.syncToken ||
  "";

export function isServiciosYaBridgeConfigured() {
  return Boolean(SERVICIOSYA_BRIDGE_BASE_URL);
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

async function getBridgeAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || SERVICIOSYA_BRIDGE_TOKEN;
}

async function requestBridge<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const authToken = await getBridgeAuthToken();
  if (!authToken) {
    throw new Error(
      "Falta sesión de usuario o EXPO_PUBLIC_SERVICIOSYA_APP_SYNC_TOKEN para conectar la app con Web/Mica.",
    );
  }

  const response = await fetch(
    `${normalizeBaseUrl(SERVICIOSYA_BRIDGE_BASE_URL)}/${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        ...(options.headers ?? {}),
      },
    },
  );

  const text = await response.text();
  let json: ServiciosYaBridgeResponse | Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {
      ok: false,
      error: text || "Respuesta no JSON del puente ServiciosYa",
    };
  }

  if (!response.ok || json?.ok === false) {
    const message =
      typeof json?.error === "string"
        ? json.error
        : `Error ${response.status} en puente ServiciosYa`;
    throw new Error(message);
  }

  return json as T;
}

export function syncPrestador(payload: ServiciosYaBridgeSyncPrestadorPayload) {
  return requestBridge<
    ServiciosYaBridgeResponse<{ action: string; marketplaceId?: string }>
  >("sync-prestador.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPedidosDisponibles(payload: {
  appUserId: string;
  telefono?: string;
  oficios: string[];
  ciudad?: string;
  provincia?: string;
  limit?: number;
}) {
  return requestBridge<ServiciosYaBridgePedidoResponse>("pedidos-disponibles.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function responderPedido(payload: ServiciosYaBridgeResponderPedidoPayload) {
  return requestBridge<
    ServiciosYaBridgeResponse<{ action: string; ofertaId: string | number }>
  >("responder-pedido.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getEstadoPedido(ofertaId: string | number, appUserId: string) {
  const params = new URLSearchParams({
    ofertaId: String(ofertaId),
    appUserId,
  });
  return requestBridge<ServiciosYaBridgeResponse>(
    `estado-pedido.php?${params.toString()}`,
    {
      method: "GET",
    },
  );
}
