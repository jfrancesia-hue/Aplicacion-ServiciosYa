export function getPaymentReturnParam(
  url: string | null | undefined,
  name: string,
) {
  if (!url || !name) return null;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = url.match(new RegExp(`[?&]${escapedName}=([^&#]+)`, "i"));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
