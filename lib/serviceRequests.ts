import type { Json } from "../types/database.types";
import { supabase } from "./supabase";

export type ServiceRequestUrgency = "normal" | "pronto" | "urgente";
export type ToolsResponsibility = "cliente" | "prestador" | "a_coordinar";
export type PreferredBudgetMode = "a_coordinar" | "proyecto" | "hora" | "dia";

export type ManualServiceRequestInput = {
  category: string;
  description: string;
  zone: string;
  city?: string | null;
  province?: string | null;
  urgency: ServiceRequestUrgency;
  toolsResponsibility: ToolsResponsibility;
  teamSize: number;
  preferredBudgetMode: PreferredBudgetMode;
};

export type MyServiceRequest = {
  id: string;
  category: string;
  zone: string;
  description: string;
  status: string;
  step: number;
  source: string;
  metadata: Json;
  createdAt: string;
  responseCount: number;
  selectedBudgetId: string | null;
  chatId: string | null;
};

export type WorkerServiceRequest = {
  id: string;
  category: string;
  zone: string;
  description: string;
  status: string;
  step: number;
  createdAt: string | null;
  mediaUrl: string | null;
  videoUrls: string | null;
  estimatedBudget: number | null;
  alreadyResponded: boolean;
  source: string;
  metadata: Json;
};

export async function createManualServiceRequest(
  input: ManualServiceRequestInput,
) {
  const { data, error } = await supabase.rpc("create_manual_service_request", {
    p_categoria: input.category,
    p_descripcion: input.description,
    p_zona: input.zone,
    p_ciudad: input.city ?? null,
    p_provincia: input.province ?? null,
    p_urgencia: input.urgency,
    p_responsable_herramientas: input.toolsResponsibility,
    p_cantidad_personas: input.teamSize,
    p_modalidad_preferida: input.preferredBudgetMode,
  });

  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.oferta_id) throw new Error("No se pudo crear la publicación.");
  return String(result.oferta_id);
}

export async function getMyServiceRequests(
  limit = 30,
): Promise<MyServiceRequest[]> {
  const { data, error } = await supabase.rpc("get_my_service_requests", {
    p_limit: limit,
  });
  if (error) throw error;

  return (data ?? []).map((item) => ({
    id: item.id,
    category: item.categoria,
    zone: item.zona,
    description: item.descripcion,
    status: item.estado,
    step: item.paso,
    source: item.source,
    metadata: item.metadata,
    createdAt: item.created_at,
    responseCount: Number(item.response_count ?? 0),
    selectedBudgetId: item.selected_budget_id,
    chatId: item.chat_id,
  }));
}

export async function cancelServiceRequest(offerId: string) {
  const { error } = await supabase.rpc("cancel_service_request", {
    p_oferta_id: offerId,
  });
  if (error) throw error;
}

export async function getWorkerServiceRequests(input: {
  userId: string;
  trades: string[];
  city?: string | null;
  province?: string | null;
  limit?: number;
}): Promise<WorkerServiceRequest[]> {
  const { data, error } = await supabase.rpc(
    "get_mica_app_requests_for_worker",
    {
      p_app_user_id: input.userId,
      p_oficios: input.trades,
      p_ciudad: input.city ?? null,
      p_provincia: input.province ?? null,
      p_limit: input.limit ?? 30,
    },
  );
  if (error) throw error;

  return (data ?? []).map((item) => ({
    id: item.id,
    category: item.categoria,
    zone: item.zona,
    description: item.descripcion,
    status: item.estado,
    step: item.paso,
    createdAt: item.created_at,
    mediaUrl: item.media_url,
    videoUrls: item.video_urls,
    estimatedBudget: item.presupuesto_estimado,
    alreadyResponded: item.ya_respondio,
    source: item.source,
    metadata: item.metadata,
  }));
}
