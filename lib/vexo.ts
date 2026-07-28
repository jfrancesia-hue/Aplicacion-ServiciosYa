import { customEvent } from "vexo-analytics";
import type { Json } from "../types/database.types";
import { supabase } from "./supabase";

export type paymentType = "registro_unico" | "plan";
export type loginType = "email" | "google" | "apple" | "huella" | "guest";
export type MarketplaceFunnelStep =
  | "location_ready"
  | "category_opened"
  | "providers_loaded"
  | "provider_profile_viewed"
  | "safe_chat_opened"
  | "availability_updated"
  | "basic_provider_registered"
  | "audio_sent"
  | "audio_transcribed"
  | "audio_transcription_failed"
  | "mica_intervention"
  | "mica_response_failed"
  | "quote_sent"
  | "payment_started"
  | "payment_confirmed"
  | "payment_failed"
  | "job_completed"
  | "rating_submitted"
  | "search_failed"
  | "location_fallback";

function contratar(id: number) {
  customEvent("contratar", { id });
}

function accept(id: string) {
  customEvent("aceptar_trabajo", { id });
}

function pago(type: paymentType, monto: number, currency = "ARS") {
  customEvent("pago", {
    tipo: type,
    monto,
    currency,
  });
}

function login(type: loginType) {
  customEvent("login", {
    tipo: type,
  });
}

function servicio(nombre: string) {
  customEvent("servicio", {
    nombre,
  });
}

function marketplace(
  step: MarketplaceFunnelStep,
  data: Record<string, string | number | boolean | null | undefined> = {},
) {
  const safeData = Object.fromEntries(
    Object.entries(data).filter(
      ([, value]) => value !== undefined && value !== null,
    ),
  ) as Record<string, string | number | boolean>;

  const eventName = `marketplace_${step}`;

  try {
    customEvent(eventName, safeData);
  } catch (error) {
    console.warn("[analytics] Vexo no disponible:", error);
  }

  void (async () => {
    try {
      const { error } = await supabase.rpc("track_marketplace_event", {
        p_event_name: eventName,
        p_context: safeData as Json,
      });
      if (error) {
        console.warn(
          "[analytics] evento operativo no registrado:",
          error.message,
        );
      }
    } catch (error) {
      console.warn("[analytics] telemetría operativa no disponible:", error);
    }
  })();
}

export default {
  accept,
  pago,
  contratar,
  login,
  servicio,
  marketplace,
};
