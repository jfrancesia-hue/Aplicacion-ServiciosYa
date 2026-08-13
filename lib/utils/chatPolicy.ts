export type ChatPolicyReason = "contact" | "price";

export type ChatPolicyResult =
  | { allowed: true }
  | { allowed: false; reason: ChatPolicyReason; message: string };

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const LINK_PATTERN = /(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|instagram\.com|facebook\.com|messenger\.com)/i;
const SOCIAL_PATTERN = /\b(?:whats?app|telegram|instagram|facebook|messenger)\b|(?:^|\s)@[a-z0-9_.]{3,}/i;
const PHONE_PATTERN = /(?:\+?\d[\s().-]*){7,}/;
const PRICE_WORD_PATTERN = /\b(?:precio|monto|tarifa|total|cobr(?:o|ar|amos|aría)|cuesta|sale|mano\s+de\s+obra)\b/i;
const MONEY_PATTERN = /(?:\$\s*\d|\b\d[\d.,]*\s*(?:ars|pesos?)\b)/i;
const LEGACY_PROTOCOL_NAMESPACE = ["TOO", "RI"].join("");
const QUOTE_PREFIX = `__${LEGACY_PROTOCOL_NAMESPACE}_QUOTE__`;

function parseProtectedQuote(content: string) {
  if (!content.startsWith(QUOTE_PREFIX)) return null;
  try {
    const quote = JSON.parse(content.slice(QUOTE_PREFIX.length));
    return quote?.type === "quote" && typeof quote.amount === "number"
      ? quote
      : null;
  } catch {
    return null;
  }
}

function containsExternalContact(value: string) {
  return (
    EMAIL_PATTERN.test(value) ||
    LINK_PATTERN.test(value) ||
    SOCIAL_PATTERN.test(value) ||
    PHONE_PATTERN.test(value)
  );
}

export function inspectChatText(value: string): ChatPolicyResult {
  const text = String(value ?? "").trim();
  if (!text) return { allowed: true };

  if (containsExternalContact(text)) {
    return {
      allowed: false,
      reason: "contact",
      message:
        "Para cuidar la contratación, no compartas teléfonos, emails, enlaces ni usuarios de redes. Coordiná dentro del chat.",
    };
  }

  if (MONEY_PATTERN.test(text) || (PRICE_WORD_PATTERN.test(text) && /\d{2,}/.test(text))) {
    return {
      allowed: false,
      reason: "price",
      message:
        "Los montos se envían desde Crear presupuesto, así quedan claros y protegidos dentro de la app.",
    };
  }

  return { allowed: true };
}

export function inspectStructuredQuote(content: string): ChatPolicyResult {
  const quote = parseProtectedQuote(content);
  if (!quote) return { allowed: true };

  const details = [
    quote.scope,
    quote.materials,
    quote.timeframe,
    quote.warranty,
    quote.validUntil,
    quote.notes,
  ]
    .filter(Boolean)
    .join(" ");

  if (containsExternalContact(details)) {
    return {
      allowed: false,
      reason: "contact",
      message:
        "El presupuesto no puede incluir teléfonos, emails, enlaces ni usuarios de redes.",
    };
  }

  return { allowed: true };
}

export function inspectChatContent(content: string): ChatPolicyResult {
  return parseProtectedQuote(content)
    ? inspectStructuredQuote(content)
    : inspectChatText(content);
}
