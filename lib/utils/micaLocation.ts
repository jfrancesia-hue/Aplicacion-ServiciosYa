import {
  getArgentineProvinceCapital,
  normalizeGeoText,
  resolveArgentineProvince,
  sameProvince,
} from "./geoSegmentation.ts";

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
    /\b(en|por|zona|barrio|localidad|ciudad(?: de)?)\s+([\p{L}\p{N}\s.'’_-]+?)(?=,|\.|\s+y\s+|\s+para\s+|\s+hoy\b|\s+ma(?:ñ|n)ana\b|\s+urgente\b|$)/iu,
  );

  if (explicitMatch?.[2]) {
    const value = cleanLocation(explicitMatch[2]);
    return normalizeGeoText(explicitMatch[1]) === "barrio"
      ? `Barrio ${value}`
      : value;
  }
  if (!acceptPlainLocation || !text || text.length > 80) return undefined;

  const candidate = cleanLocation(
    text.replace(/^(?:estoy|vivo|trabajo|ser[ií]a|es)\s+(?:en\s+)?/iu, ""),
  );
  const wordCount = candidate.split(/\s+/).length;
  const isNonLocationReply =
    /^(?:s[ií]|no|dale|ok|bueno|urgente|hoy|ma(?:ñ|n)ana|esta semana)\b/iu.test(
      candidate,
    );
  const describesAnotherNeed =
    /\b(?:quiero|necesito|busco|tengo|puede|horario|precio|presupuesto)\b/iu.test(
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

export function resolveMicaRequestLocation(input: {
  requestedZone?: string | null;
  fallbackCity?: string | null;
  fallbackProvince?: string | null;
}) {
  const zone = cleanLocation(input.requestedZone ?? "");
  const fallbackCity = cleanLocation(input.fallbackCity ?? "") || null;
  const fallbackProvince = resolveArgentineProvince(input.fallbackProvince);
  const requestedProvince = resolveArgentineProvince(zone);
  const province = requestedProvince || fallbackProvince;
  const normalizedZone = normalizeGeoText(zone);
  const normalizedProvince = normalizeGeoText(requestedProvince);
  const isNeighbourhood = /^(?:barrio|zona)\b/.test(normalizedZone);
  const fallbackIsSameProvince =
    requestedProvince && fallbackProvince
      ? sameProvince(requestedProvince, fallbackProvince)
      : false;

  if (!zone) {
    return { city: fallbackCity, province: fallbackProvince };
  }

  if (isNeighbourhood) {
    return {
      city: fallbackCity,
      province: fallbackProvince,
    };
  }

  if (normalizedZone === "capital" && fallbackProvince) {
    return {
      city: getArgentineProvinceCapital(fallbackProvince) || fallbackCity,
      province: fallbackProvince,
    };
  }

  if (requestedProvince) {
    const provinceCapital = getArgentineProvinceCapital(requestedProvince);
    const asksForCapital =
      /\bcapital\b/.test(normalizedZone) || /\bciudad\b/.test(normalizedZone);
    const isOnlyProvince = normalizedZone === normalizedProvince;
    const includesProvinceCapital = Boolean(
      provinceCapital &&
        normalizedZone.includes(normalizeGeoText(provinceCapital)),
    );
    const includesFallbackCity = Boolean(
      fallbackCity &&
        normalizedZone.includes(normalizeGeoText(fallbackCity)) &&
        fallbackIsSameProvince,
    );

    return {
      city: includesFallbackCity
        ? fallbackCity
        : includesProvinceCapital
          ? provinceCapital
          : asksForCapital
            ? provinceCapital
            : isOnlyProvince
              ? fallbackIsSameProvince
                ? fallbackCity
                : null
              : zone,
      province: requestedProvince,
    };
  }

  return {
    city: zone,
    province: fallbackProvince,
  };
}

/**
 * Una zona libre (por ejemplo, "Barrio 9 de Julio") no alcanza para publicar.
 * El pedido solo queda listo cuando podemos guardar ciudad y provincia por
 * separado, ya sea porque las dijo el cliente o porque vienen del perfil/GPS.
 */
export function getMicaRequestLocationStatus(input: {
  requestedZone?: string | null;
  fallbackCity?: string | null;
  fallbackProvince?: string | null;
}) {
  const requestedZone = cleanLocation(input.requestedZone ?? "") || null;
  const resolved = resolveMicaRequestLocation(input);
  const isComplete = Boolean(resolved.city && resolved.province);
  const normalizedRequestedZone = normalizeGeoText(requestedZone);
  const parts = [
    requestedZone,
    resolved.city &&
    !normalizedRequestedZone.includes(normalizeGeoText(resolved.city))
      ? resolved.city
      : null,
    resolved.province &&
    !normalizedRequestedZone.includes(normalizeGeoText(resolved.province))
      ? resolved.province
      : null,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  const uniqueParts = parts.filter(
    (part, index) =>
      parts.findIndex(
        (candidate) => normalizeGeoText(candidate) === normalizeGeoText(part),
      ) === index,
  );

  return {
    ...resolved,
    requestedZone,
    isComplete,
    label: isComplete ? uniqueParts.join(", ") : null,
    draftLabel: uniqueParts.join(", ") || null,
  };
}

export type MicaRequestLocationStatus = ReturnType<
  typeof getMicaRequestLocationStatus
>;
