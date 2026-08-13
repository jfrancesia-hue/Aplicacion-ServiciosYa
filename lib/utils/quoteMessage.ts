import type { QuotePricingMode, QuoteReferenceType } from "./quotePricing";
import { QUOTE_OPERATIONAL_NOTICE_VERSION } from "../constants/billing.ts";

export type QuoteMessage = {
  type: "quote";
  amount: number;
  scope: string;
  materials: string;
  timeframe: string;
  warranty: string;
  validUntil: string;
  notes?: string;
  source?: "chat" | "mica";
  sourceBudgetId?: string;
  pricingMode?: QuotePricingMode;
  unitRate?: number;
  estimatedUnits?: number;
  referenceType?: QuoteReferenceType;
  operationalNoticeVersion?: string;
  operationalNoticeAcceptedAt?: string;
  createdAt: string;
};

const LEGACY_PROTOCOL_NAMESPACE = ["TOO", "RI"].join("");
const QUOTE_PREFIX = `__${LEGACY_PROTOCOL_NAMESPACE}_QUOTE__`;

export function createQuoteMessage(
  quote: Omit<QuoteMessage, "type" | "createdAt">,
) {
  return `${QUOTE_PREFIX}${JSON.stringify({
    type: "quote",
    ...quote,
    createdAt: new Date().toISOString(),
  } satisfies QuoteMessage)}`;
}

export function parseQuoteMessage(content: unknown): QuoteMessage | null {
  if (typeof content !== "string" || !content.startsWith(QUOTE_PREFIX))
    return null;

  try {
    const quote = JSON.parse(content.slice(QUOTE_PREFIX.length));
    if (quote?.type !== "quote" || typeof quote.amount !== "number")
      return null;
    return quote as QuoteMessage;
  } catch {
    return null;
  }
}

export function acknowledgeQuoteOperationalNotice(content: string) {
  const quote = parseQuoteMessage(content);
  if (!quote) throw new Error("Presupuesto inválido.");
  return `${QUOTE_PREFIX}${JSON.stringify({
    ...quote,
    operationalNoticeVersion: QUOTE_OPERATIONAL_NOTICE_VERSION,
    operationalNoticeAcceptedAt: new Date().toISOString(),
  } satisfies QuoteMessage)}`;
}

export function getQuotePricing(quote: QuoteMessage) {
  return {
    pricingMode: quote.pricingMode ?? "project",
    unitRate: quote.unitRate ?? quote.amount,
    estimatedUnits: quote.estimatedUnits ?? 1,
    referenceType: quote.referenceType ?? "fixed",
    amount: quote.amount,
  };
}

export function formatQuoteAmount(amount: number) {
  return `$${Math.round(amount).toLocaleString("es-AR")}`;
}
