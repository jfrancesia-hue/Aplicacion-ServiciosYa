const SERVICE_SYSTEM_PREFIX = "__SERVICIOSYA_SYSTEM_V1__:";

export type ServiceSystemMessage = {
  kind:
    | "booking_confirmed"
    | "visit_proposed"
    | "visit_scheduled"
    | "visit_reschedule_requested"
    | "cancellation_requested"
    | "cancellation_review"
    | "cancellation_rejected"
    | "reservation_refunded"
    | "refund_failed"
    | "urgent_request_matched";
  title: string;
  text: string;
  actorId?: string;
  eventId?: string;
};

export function createServiceSystemContent(message: ServiceSystemMessage) {
  return `${SERVICE_SYSTEM_PREFIX}${JSON.stringify(message)}`;
}

export function parseServiceSystemMessage(
  content?: string | null,
): ServiceSystemMessage | null {
  if (!content?.startsWith(SERVICE_SYSTEM_PREFIX)) return null;

  try {
    const parsed = JSON.parse(
      content.slice(SERVICE_SYSTEM_PREFIX.length),
    ) as Partial<ServiceSystemMessage>;
    if (
      ![
        "booking_confirmed",
        "visit_proposed",
        "visit_scheduled",
        "visit_reschedule_requested",
        "cancellation_requested",
        "cancellation_review",
        "cancellation_rejected",
        "reservation_refunded",
        "refund_failed",
        "urgent_request_matched",
      ].includes(String(parsed.kind)) ||
      typeof parsed.title !== "string" ||
      typeof parsed.text !== "string"
    ) {
      return null;
    }

    return {
      kind: parsed.kind as ServiceSystemMessage["kind"],
      title: parsed.title.trim(),
      text: parsed.text.trim(),
      actorId: parsed.actorId ? String(parsed.actorId) : undefined,
      eventId: parsed.eventId ? String(parsed.eventId) : undefined,
    };
  } catch {
    return null;
  }
}

export function getServiceSystemMessagePreview(content?: string | null) {
  const message = parseServiceSystemMessage(content);
  return message
    ? `ServiciosYa: ${message.text.replace(/\s+/g, " ").trim()}`
    : null;
}
