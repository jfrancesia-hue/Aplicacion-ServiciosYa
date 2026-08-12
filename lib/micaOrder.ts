import { supabase } from "./supabase";

export type MicaOrderQuote = {
  id: string;
  workerId: string;
  name: string;
  amount: number;
  rating: number | null;
  jobs: number;
  availability: string;
  description: string;
  materials: string;
  warranty: string;
  validUntil: string;
  notes?: string;
  verified: boolean;
  avatar?: string | null;
  selected: boolean;
};

export type MicaOrderStatus = {
  order: {
    id: string;
    phase: string;
    status: string;
    step: number;
    category: string;
    zone: string;
    description: string;
    selectedBudgetId?: string | null;
    chatId?: string | null;
  } | null;
  quotes: MicaOrderQuote[];
};

export type MicaOrderSelection = {
  chat: {
    id: string;
    participantA: string;
    participantB: string;
    providerId: string;
    providerName: string;
  };
  quote: MicaOrderQuote;
  quoteMessageId: string;
};

async function invokeMicaOrder<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<
    T & { error?: string }
  >("mica-order", { body });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function getMicaOrderStatus(offerId?: string | null) {
  return invokeMicaOrder<MicaOrderStatus>({
    action: "status",
    ...(offerId ? { offerId } : {}),
  });
}

export function selectMicaOrderQuote(offerId: string, budgetId: string) {
  return invokeMicaOrder<MicaOrderSelection>({
    action: "select",
    offerId,
    budgetId,
  });
}

export function respondToMicaOrder(
  offerId: string,
  response:
    | {
        type: "budget";
        amount: number;
        availability?: string;
        description?: string;
        materials?: string;
        warranty?: string;
        validUntil?: string;
        notes?: string;
      }
    | { type: "decline" },
) {
  return invokeMicaOrder<{ ok: boolean; action: string; budgetId?: string }>({
    action: "respond",
    offerId,
    response,
  });
}

export function formatMicaOrderAmount(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}
