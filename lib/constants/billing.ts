export const SERVICE_CONFIRMATION_COMMISSION_RATE = 0.1;
export const QUOTE_OPERATIONAL_NOTICE_VERSION = "quote-operation-v1-2026-08-12";

export const PROVIDER_MONTHLY_SUBSCRIPTION_ARS = 10000;
export const PROVIDER_MONTHLY_SUBSCRIPTION_START_DATE = "2026-07-02";

export function isProviderMonthlySubscriptionActive(now = new Date()) {
  return (
    now >=
    new Date(`${PROVIDER_MONTHLY_SUBSCRIPTION_START_DATE}T00:00:00-03:00`)
  );
}

export function calculateServiceConfirmationFee(amount: number) {
  return Math.round(amount * SERVICE_CONFIRMATION_COMMISSION_RATE * 100) / 100;
}
