import { supabase } from "./supabase";

export type ServiceJob = {
  paymentRecordId: string;
  chatId: string;
  payerId: string;
  providerId: string;
  isPayer: boolean;
  isProvider: boolean;
  counterpartId: string;
  counterpartName: string;
  counterpartAvatar: string | null;
  title: string;
  description: string;
  amountTotal: number;
  pricingMode: "project" | "hour" | "day";
  jobStatus: "confirmed" | "completed" | "disputed" | "cancelled";
  scheduleStatus:
    | "not_ready"
    | "awaiting_provider_options"
    | "awaiting_selection"
    | "scheduled";
  scheduleRound: number;
  scheduleProposedBy: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  incidentId: string | null;
  incidentCaseNumber: string | null;
  incidentStatus: string | null;
  reviewRating: number | null;
  requiresAction: boolean;
  canClose: boolean;
  createdAt: string;
};

export async function getMyServiceJobs(limit = 100): Promise<ServiceJob[]> {
  const { data, error } = await supabase.rpc("get_my_service_jobs", {
    p_limit: limit,
  });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    paymentRecordId: row.payment_record_id,
    chatId: row.chat_id,
    payerId: row.payer_id,
    providerId: row.provider_id,
    isPayer: row.is_payer,
    isProvider: row.is_provider,
    counterpartId: row.counterpart_id,
    counterpartName: row.counterpart_name,
    counterpartAvatar: row.counterpart_avatar,
    title: row.title,
    description: row.description,
    amountTotal: Number(row.amount_total ?? 0),
    pricingMode:
      row.pricing_mode === "hour" || row.pricing_mode === "day"
        ? row.pricing_mode
        : "project",
    jobStatus: row.job_status as ServiceJob["jobStatus"],
    scheduleStatus: row.schedule_status as ServiceJob["scheduleStatus"],
    scheduleRound: row.schedule_round,
    scheduleProposedBy: row.schedule_proposed_by,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    incidentId: row.incident_id,
    incidentCaseNumber: row.incident_case_number,
    incidentStatus: row.incident_status,
    reviewRating: row.review_rating,
    requiresAction: Boolean(row.requires_action),
    canClose: Boolean(row.can_close),
    createdAt: row.created_at,
  }));
}

export function serviceJobSection(job: ServiceJob) {
  if (job.jobStatus === "disputed") return "claims" as const;
  if (job.requiresAction) return "action" as const;
  if (job.jobStatus === "confirmed" && job.scheduleStatus === "scheduled")
    return "scheduled" as const;
  if (job.jobStatus === "confirmed") return "coordination" as const;
  return "history" as const;
}
