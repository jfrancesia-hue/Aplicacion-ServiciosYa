export type QuotePricingMode = "project" | "hour" | "day";
export type QuoteReferenceType = "fixed" | "estimate" | "cap";

export type QuotePricing = {
  pricingMode: QuotePricingMode;
  unitRate: number;
  estimatedUnits: number;
  referenceType: QuoteReferenceType;
  amount: number;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function calculateQuoteReferenceTotal(
  pricingMode: QuotePricingMode,
  unitRate: number,
  estimatedUnits = 1,
) {
  const rate = Number(unitRate);
  const units = pricingMode === "project" ? 1 : Number(estimatedUnits);
  if (
    !Number.isFinite(rate) ||
    !Number.isFinite(units) ||
    rate <= 0 ||
    units <= 0
  ) {
    return 0;
  }
  return roundMoney(rate * units);
}

export function buildQuotePricing(input: {
  pricingMode: QuotePricingMode;
  unitRate: number;
  estimatedUnits?: number;
  referenceType?: QuoteReferenceType;
}): QuotePricing {
  const estimatedUnits =
    input.pricingMode === "project" ? 1 : Number(input.estimatedUnits ?? 0);
  const referenceType =
    input.pricingMode === "project"
      ? "fixed"
      : input.referenceType === "cap"
        ? "cap"
        : "estimate";
  return {
    pricingMode: input.pricingMode,
    unitRate: roundMoney(Number(input.unitRate)),
    estimatedUnits,
    referenceType,
    amount: calculateQuoteReferenceTotal(
      input.pricingMode,
      input.unitRate,
      estimatedUnits,
    ),
  };
}

export function pricingModeLabel(mode: QuotePricingMode) {
  if (mode === "hour") return "Por hora";
  if (mode === "day") return "Por día";
  return "Por proyecto";
}

export function quotePricingSummary(pricing: QuotePricing) {
  if (pricing.pricingMode === "project") return "Importe cerrado por proyecto";
  const unit = pricing.pricingMode === "hour" ? "hora" : "día";
  const kind = pricing.referenceType === "cap" ? "tope" : "estimado";
  return `$${Math.round(pricing.unitRate).toLocaleString("es-AR")} por ${unit} × ${pricing.estimatedUnits} (${kind})`;
}
