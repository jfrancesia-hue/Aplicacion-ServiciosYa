import { supabase } from "./supabase";

export type ScheduleSlot = {
  id: string;
  position: number;
  startsAt: string;
  endsAt: string;
  timezone: string;
  selected: boolean;
};

export type ChatSchedule = {
  paymentRecordId: string;
  scheduleStatus:
    | "not_ready"
    | "awaiting_provider_options"
    | "awaiting_selection"
    | "scheduled";
  scheduleRound: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduledTimezone: string | null;
  isProvider: boolean;
  isPayer: boolean;
  canProposeInitial: boolean;
  canProposeReschedule: boolean;
  proposalId: string | null;
  proposalReason: "initial" | "reschedule" | null;
  proposalStatus: "pending" | "selected" | "superseded" | "cancelled" | null;
  proposedByMe: boolean;
  canSelect: boolean;
  optionsExpired: boolean;
  canReplaceExpired: boolean;
  slots: ScheduleSlot[];
};

type ScheduleRpc = {
  payment_record_id?: string;
  schedule_status?: ChatSchedule["scheduleStatus"];
  schedule_round?: number;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  scheduled_timezone?: string | null;
  is_provider?: boolean;
  is_payer?: boolean;
  can_propose_initial?: boolean;
  can_propose_reschedule?: boolean;
  proposal_id?: string | null;
  proposal_reason?: ChatSchedule["proposalReason"];
  proposal_status?: ChatSchedule["proposalStatus"];
  proposed_by_me?: boolean;
  can_select?: boolean;
  options_expired?: boolean;
  can_replace_expired?: boolean;
  slots?: Array<{
    id: string;
    position: number;
    starts_at: string;
    ends_at: string;
    timezone: string;
    selected: boolean;
  }>;
};

export async function getChatSchedule(
  chatId: string,
): Promise<ChatSchedule | null> {
  const { data, error } = await supabase.rpc("get_chat_schedule", {
    p_chat_id: chatId,
  });
  if (error) throw error;
  const value = (data ?? {}) as ScheduleRpc;
  if (!value.payment_record_id || !value.schedule_status) return null;

  return {
    paymentRecordId: value.payment_record_id,
    scheduleStatus: value.schedule_status,
    scheduleRound: Number(value.schedule_round ?? 0),
    scheduledStart: value.scheduled_start ?? null,
    scheduledEnd: value.scheduled_end ?? null,
    scheduledTimezone: value.scheduled_timezone ?? null,
    isProvider: Boolean(value.is_provider),
    isPayer: Boolean(value.is_payer),
    canProposeInitial: Boolean(value.can_propose_initial),
    canProposeReschedule: Boolean(value.can_propose_reschedule),
    proposalId: value.proposal_id ?? null,
    proposalReason: value.proposal_reason ?? null,
    proposalStatus: value.proposal_status ?? null,
    proposedByMe: Boolean(value.proposed_by_me),
    canSelect: Boolean(value.can_select),
    optionsExpired: Boolean(value.options_expired),
    canReplaceExpired: Boolean(value.can_replace_expired),
    slots: (value.slots ?? []).map((slot) => ({
      id: slot.id,
      position: slot.position,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      timezone: slot.timezone,
      selected: slot.selected,
    })),
  };
}

export async function proposeServiceSchedule(input: {
  paymentRecordId: string;
  reason: "initial" | "reschedule";
  startsAt: Date[];
}) {
  const { error } = await supabase.rpc("propose_service_schedule", {
    p_payment_record_id: input.paymentRecordId,
    p_reason: input.reason,
    p_slots: input.startsAt.map((start) => ({
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      timezone: "America/Buenos_Aires",
    })),
  });
  if (error) throw error;
}

export async function selectServiceScheduleSlot(input: {
  proposalId: string;
  slotId: string;
}) {
  const { error } = await supabase.rpc("select_service_schedule_slot", {
    p_proposal_id: input.proposalId,
    p_slot_id: input.slotId,
  });
  if (error) throw error;
}
