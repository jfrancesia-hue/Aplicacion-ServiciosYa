function cleanLocation(value: string) {
  return value
    .trim()
    .replace(/^[,.;:\s]+|[,.;:\s]+$/g, "")
    .replace(/\s+/g, " ");
}

export function inferMicaLocation(
  userText: string,
  acceptPlainLocation = false,
) {
  const text = cleanLocation(userText);
  const explicitMatch = text.match(
    /\b(?:en|por|zona|barrio|localidad|ciudad(?: de)?)\s+([\p{L}\p{N}\s.'’_-]+?)(?=,|\.|\s+y\s+|\s+para\s+|\s+hoy\b|\s+ma(?:ñ|n)ana\b|\s+urgente\b|$)/iu,
  );

  if (explicitMatch?.[1]) return cleanLocation(explicitMatch[1]);
  if (!acceptPlainLocation || !text || text.length > 80) return undefined;

  const candidate = cleanLocation(
    text.replace(/^(?:estoy|vivo|trabajo|ser[ií]a|es)\s+(?:en\s+)?/iu, ""),
  );
  const wordCount = candidate.split(/\s+/).length;
  const isNonLocationReply = /^(?:s[ií]|no|dale|ok|bueno|urgente|hoy|ma(?:ñ|n)ana|esta semana)\b/iu.test(
    candidate,
  );
  const describesAnotherNeed = /\b(?:quiero|necesito|busco|tengo|puede|horario|precio|presupuesto)\b/iu.test(
    candidate,
  );

  if (
    wordCount > 7 ||
    isNonLocationReply ||
    describesAnotherNeed ||
    !/[\p{L}\p{N}]/u.test(candidate)
  ) {
    return undefined;
  }

  return candidate;
}

export function asksForKnownLocation(
  reply: string | undefined,
  knownLocation: string | undefined,
) {
  if (!reply?.trim() || !knownLocation?.trim()) return false;

  const normalized = reply
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  return (
    /\b(?:en )?que (?:ciudad|barrio|zona|localidad)\b/.test(normalized) ||
    /\bdonde (?:hay que|se va a|debe|necesitas|necesita).*(?:trabajo|servicio|resolver)/.test(
      normalized,
    )
  );
}
