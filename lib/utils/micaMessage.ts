const LEGACY_PROTOCOL_NAMESPACE = ["TOO", "RI"].join("");
const HANDOFF_PREFIX = `__${LEGACY_PROTOCOL_NAMESPACE}_MICA_HANDOFF_V1__:`;
const ASSISTANT_PREFIX = `__${LEGACY_PROTOCOL_NAMESPACE}_MICA_ASSIST_V1__:`;

export type MicaSystemMessage = {
  kind: "handoff" | "assistant";
  title: string;
  text: string;
  offerId?: string;
  budgetId?: string;
  requestedBy?: string;
};

export function createMicaAssistantContent(text: string, requestedBy?: string) {
  return `${ASSISTANT_PREFIX}${JSON.stringify({
    kind: "assistant",
    title: "MICA ayuda a coordinar",
    text: text.trim(),
    requestedBy,
  })}`;
}

export function parseMicaSystemMessage(
  content?: string | null,
): MicaSystemMessage | null {
  if (!content) return null;

  const prefix = content.startsWith(HANDOFF_PREFIX)
    ? HANDOFF_PREFIX
    : content.startsWith(ASSISTANT_PREFIX)
      ? ASSISTANT_PREFIX
      : null;
  if (!prefix) return null;

  try {
    const parsed = JSON.parse(
      content.slice(prefix.length),
    ) as Partial<MicaSystemMessage>;
    if (
      (parsed.kind !== "handoff" && parsed.kind !== "assistant") ||
      typeof parsed.title !== "string" ||
      typeof parsed.text !== "string"
    ) {
      return null;
    }

    return {
      kind: parsed.kind,
      title: parsed.title.trim(),
      text: parsed.text.trim(),
      offerId: parsed.offerId ? String(parsed.offerId) : undefined,
      budgetId: parsed.budgetId ? String(parsed.budgetId) : undefined,
      requestedBy: parsed.requestedBy ? String(parsed.requestedBy) : undefined,
    };
  } catch {
    return null;
  }
}

export function getMicaSystemMessagePreview(content?: string | null) {
  const message = parseMicaSystemMessage(content);
  if (!message) return null;
  return `MICA: ${message.text.replace(/\s+/g, " ").trim()}`;
}
