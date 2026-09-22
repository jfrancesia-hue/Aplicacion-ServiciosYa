import { supabase } from "../supabase";

type SupabaseClient = typeof supabase;

export const URGENT_WORK_CHANNEL_ID = "urgent-work";
export const URGENT_WORK_SOUND = "urgent_work.wav";

type UrgentWorkAlertSource = "service_request" | "direct_contact";

type CreateUrgentWorkAlertParams = {
  supabase: SupabaseClient;
  source: UrgentWorkAlertSource;
  workerId: string | null | undefined;
  clienteId?: string | null;
  servicioId?: string | number | null;
  chatId?: string | null;
  notificacionId?: string | null;
  category?: string | null;
  title?: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export async function createUrgentWorkAlert({
  supabase,
  source,
  workerId,
  clienteId,
  servicioId,
  chatId,
  notificacionId,
  category,
  title = "Tenes trabajo urgente",
  body,
  metadata = {},
}: CreateUrgentWorkAlertParams) {
  if (!workerId) return null;

  const { data, error } = await supabase.rpc("create_urgent_work_alert", {
    p_worker_id: workerId,
    p_source: source,
    p_category: category ?? undefined,
    p_chat_id: chatId ?? undefined,
    p_servicio_id: servicioId == null ? undefined : String(servicioId),
    p_title: title,
    p_body: body,
    p_metadata: {
      ...metadata,
      legacy_notification_id: notificacionId ?? null,
      requested_cliente_id: clienteId ?? null,
    },
  });
  if (error) throw error;
  return data;
}

export async function respondToUrgentWorkAlert(
  alertId: string,
  response: "accepted" | "declined",
) {
  const { data, error } = await supabase.rpc("respond_to_urgent_work_alert", {
    p_alert_id: alertId,
    p_response: response,
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    reason?: "expired" | "already_resolved";
    status: string;
    response_deadline?: string;
  };
}
