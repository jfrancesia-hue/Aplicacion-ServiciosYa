export type MicaSearchTiming = {
  urgency?: "Alta" | "Media" | "Flexible";
  timeframe?: "Hoy" | "Flexible";
};

function includesAny(text: string, signals: string[]) {
  return signals.some((signal) => text.includes(signal));
}

export function inferMicaSearchTiming(userText: string): MicaSearchTiming {
  const text = userText.trim().toLocaleLowerCase("es-AR");
  const result: MicaSearchTiming = {};

  if (
    includesAny(text, [
      "urgente",
      "emergencia",
      "ahora",
      "inund",
      "sin luz",
      "sin agua",
    ])
  ) {
    result.urgency = "Alta";
  } else if (includesAny(text, ["hoy", "rápido", "rapido", "esta tarde"])) {
    result.urgency = "Media";
  } else if (
    includesAny(text, [
      "semana",
      "mañana",
      "manana",
      "puede ser",
      "sin apuro",
      "no es urgente",
      "coordinar",
      "comparar precio",
    ])
  ) {
    result.urgency = "Flexible";
  }

  if (includesAny(text, ["hoy", "esta tarde"])) {
    result.timeframe = "Hoy";
  } else if (
    includesAny(text, [
      "mañana",
      "manana",
      "semana",
      "fin de semana",
      "puede ser",
      "sin apuro",
      "coordinar",
      "comparar precio",
    ])
  ) {
    result.timeframe = "Flexible";
  }

  return result;
}

function normalizeClaimText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("es-AR");
}

export function containsFalseRequestCompletionClaim(text: string) {
  const normalized = normalizeClaimText(text);
  return [
    /(?:ya\s+)?quedo\s+(?:todo\s+)?registrad/,
    /(?:ya\s+)?(?:registre|registramos|guardamos|publique|publicamos|envie|enviamos)\s+(?:tu|el)\s+(?:pedido|solicitud|trabajo)/,
    /(?:tu|el)\s+(?:pedido|solicitud|trabajo)\s+(?:ya\s+)?(?:quedo|esta|fue)\s+(?:registrad|guardad|publicad|enviad|cread)/,
    /(?:en breve|pronto)\s+te\s+(?:van a contactar|contactaran)/,
  ].some((pattern) => pattern.test(normalized));
}

export function guardUnpersistedMicaReply(
  reply: string,
  hasPersistedRequest: boolean,
) {
  if (hasPersistedRequest || !containsFalseRequestCompletionClaim(reply)) {
    return reply;
  }

  return 'Ya tengo los datos necesarios. El pedido todavía no está publicado: revisalos y tocá "Pedir presupuestos". Recién cuando la app muestre un número de seguimiento quedará guardado.';
}
