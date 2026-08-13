export const CHAT_AUDIO_BUCKET = "chat-audios";
export const CHAT_AUDIO_MAX_SECONDS = 120;

const LEGACY_PROTOCOL_NAMESPACE = ["TOO", "RI"].join("");
const AUDIO_MESSAGE_PREFIX = `__${LEGACY_PROTOCOL_NAMESPACE}_AUDIO_V1__:`;

export interface AudioMessagePayload {
  kind: "audio";
  path: string;
  durationMs: number;
  mimeType: string;
  transcript?: string;
}

export function createAudioMessageContent(
  payload: Omit<AudioMessagePayload, "kind">,
) {
  return `${AUDIO_MESSAGE_PREFIX}${JSON.stringify({
    kind: "audio",
    ...payload,
    transcript: payload.transcript?.trim() || undefined,
  })}`;
}

export function parseAudioMessageContent(
  content?: string | null,
): AudioMessagePayload | null {
  if (!content?.startsWith(AUDIO_MESSAGE_PREFIX)) return null;

  try {
    const parsed = JSON.parse(
      content.slice(AUDIO_MESSAGE_PREFIX.length),
    ) as Partial<AudioMessagePayload>;

    if (
      parsed.kind !== "audio" ||
      typeof parsed.path !== "string" ||
      typeof parsed.durationMs !== "number" ||
      typeof parsed.mimeType !== "string"
    ) {
      return null;
    }

    return {
      kind: "audio",
      path: parsed.path,
      durationMs: Math.max(0, parsed.durationMs),
      mimeType: parsed.mimeType,
      transcript:
        typeof parsed.transcript === "string"
          ? parsed.transcript.trim()
          : undefined,
    };
  } catch {
    return null;
  }
}

export function formatAudioDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function getChatMessagePreview(content?: string | null) {
  const audio = parseAudioMessageContent(content);
  if (!audio) return content?.trim() || "Entrá para comenzar a chatear";

  const transcript = audio.transcript?.replace(/\s+/g, " ").trim();
  return transcript
    ? `🎤 ${transcript}`
    : `🎤 Mensaje de voz · ${formatAudioDuration(audio.durationMs)}`;
}
