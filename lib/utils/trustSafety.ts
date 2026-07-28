import { supabase } from "../supabase";

export const REPORT_REASONS = [
  {
    label: "Contenido inapropiado",
    value: "inappropriate_content",
  },
  {
    label: "Información falsa o engañosa",
    value: "false_information",
  },
  { label: "Spam o publicidad", value: "spam" },
  { label: "Posible estafa o fraude", value: "potential_scam" },
  { label: "Problema de seguridad", value: "security_issue" },
  { label: "Otro motivo", value: "other" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

async function requireUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Necesitás iniciar sesión para realizar esta acción.");
  }
  return user.id;
}
export async function reportProvider({
  providerId,
  serviceId,
  reason,
  details,
}: {
  providerId: string;
  serviceId?: number | null;
  reason: ReportReason;
  details?: string | null;
}) {
  const reporterId = await requireUserId();
  if (reporterId === providerId) {
    throw new Error("No podés reportar tu propio perfil.");
  }

  const { error } = await supabase.from("profile_reports").insert({
    reporter_id: reporterId,
    provider_id: providerId,
    service_id: serviceId ?? null,
    reason_category: reason,
    details: details?.trim() || null,
  });

  if (error) throw new Error(error.message);
}

export async function blockUser(blockedId: string) {
  const blockerId = await requireUserId();
  if (blockerId === blockedId) {
    throw new Error("No podés bloquear tu propio perfil.");
  }

  const { error } = await supabase.from("user_blocks").upsert(
    {
      blocker_id: blockerId,
      blocked_id: blockedId,
    },
    { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
  );

  if (error) throw new Error(error.message);
}

export async function unblockUser(blockedId: string) {
  const blockerId = await requireUserId();
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);

  if (error) throw new Error(error.message);
}

export async function getBlockedUserIds() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set<string>();

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", user.id);

  if (error) {
    console.warn("[trustSafety] no se pudieron cargar los bloqueos:", error);
    return new Set<string>();
  }

  return new Set((data ?? []).map((item) => item.blocked_id));
}

export async function getBlockedUsers() {
  const blockedIds = Array.from(await getBlockedUserIds());
  if (blockedIds.length === 0) return [];

  const { data, error } = await supabase
    .from("usuarios")
    .select("id,nombre,foto_perfil")
    .in("id", blockedIds);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function isUserBlockedByMe(blockedId: string) {
  const blockedIds = await getBlockedUserIds();
  return blockedIds.has(blockedId);
}
