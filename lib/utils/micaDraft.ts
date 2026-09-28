import type { MicaChatMode } from "../../types/navigation";

export type MicaDraftMessage = {
  id: string;
  author: "mica" | "user";
  text: string;
};

export type MicaDraftInsight = {
  issue?: string;
  service?: string;
  location?: string;
  urgency?: string;
  timeframe?: string;
  media?: string;
  experience?: string;
  coverage?: string;
  price?: string;
  companyType?: string;
  units?: string;
  contactIntent?: string;
};

export type MicaDraft = {
  version: 1;
  savedAt: string;
  messages: MicaDraftMessage[];
  insight: MicaDraftInsight;
};

const DRAFT_PREFIX = "mica-draft-v1";
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_FIELD_LENGTH = 500;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

export function micaDraftKey(userId: string, mode: MicaChatMode) {
  return `${DRAFT_PREFIX}:${userId}:${mode}`;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

export function sanitizeMicaDraft(
  value: unknown,
  now = Date.now(),
): MicaDraft | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<MicaDraft>;
  const savedAtMs = Date.parse(raw.savedAt ?? "");
  if (!Number.isFinite(savedAtMs) || now - savedAtMs > MAX_AGE_MS) {
    return null;
  }

  const messages = (Array.isArray(raw.messages) ? raw.messages : [])
    .filter(
      (message): message is MicaDraftMessage =>
        Boolean(message) &&
        typeof message === "object" &&
        (message.author === "mica" || message.author === "user") &&
        !String(message.id ?? "").includes("thinking") &&
        Boolean(cleanText(message.text, MAX_MESSAGE_LENGTH)),
    )
    .slice(-MAX_MESSAGES)
    .map((message, index) => ({
      id: cleanText(message.id, 120) || `restored-${index}`,
      author: message.author,
      text: cleanText(message.text, MAX_MESSAGE_LENGTH),
    }));

  const insight = Object.fromEntries(
    Object.entries(raw.insight ?? {})
      .map(([key, fieldValue]) => [key, cleanText(fieldValue, MAX_FIELD_LENGTH)])
      .filter(([, fieldValue]) => Boolean(fieldValue)),
  ) as MicaDraftInsight;

  const hasUserMessage = messages.some((message) => message.author === "user");
  if (!hasUserMessage && Object.keys(insight).length === 0) return null;

  return {
    version: 1,
    savedAt: new Date(savedAtMs).toISOString(),
    messages,
    insight,
  };
}
