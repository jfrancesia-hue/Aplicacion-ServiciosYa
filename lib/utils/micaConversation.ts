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
