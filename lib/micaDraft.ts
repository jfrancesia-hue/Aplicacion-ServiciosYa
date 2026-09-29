import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MicaChatMode } from "../types/navigation";
import {
  micaDraftKey,
  sanitizeMicaDraft,
  type MicaDraft,
} from "./utils/micaDraft";

export type {
  MicaDraft,
  MicaDraftInsight,
  MicaDraftMessage,
} from "./utils/micaDraft";

export async function loadMicaDraft(
  userId: string,
  mode: MicaChatMode,
): Promise<MicaDraft | null> {
  const key = micaDraftKey(userId, mode);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    const draft = sanitizeMicaDraft(JSON.parse(raw));
    if (!draft) await AsyncStorage.removeItem(key);
    return draft;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function saveMicaDraft(
  userId: string,
  mode: MicaChatMode,
  draft: Pick<MicaDraft, "messages" | "insight">,
) {
  const key = micaDraftKey(userId, mode);
  const sanitized = sanitizeMicaDraft({
    version: 1,
    savedAt: new Date().toISOString(),
    messages: draft.messages,
    insight: draft.insight,
  });

  if (!sanitized) {
    await AsyncStorage.removeItem(key);
    return;
  }

  await AsyncStorage.setItem(key, JSON.stringify(sanitized));
}

export async function clearMicaDraft(
  userId: string,
  mode: MicaChatMode,
) {
  await AsyncStorage.removeItem(micaDraftKey(userId, mode));
}
