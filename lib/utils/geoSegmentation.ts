type LocationParts = {
  ciudad?: string | null;
  provincia?: string | null;
  localidad?: string | null;
  barrio?: string | null;
};

const ARGENTINE_PROVINCES = [
  {
    name: "Ciudad Autónoma de Buenos Aires",
    aliases: [
      "caba",
      "capital federal",
      "ciudad autonoma de buenos aires",
      "buenos aires capital",
      "buenos aires ciudad",
    ],
  },
  {
    name: "Buenos Aires",
    aliases: ["provincia de buenos aires", "buenos aires", "la plata"],
  },
  {
    name: "Catamarca",
    aliases: [
      "catamarca",
      "san fernando del valle de catamarca",
      "san fernando de catamarca",
      "valle viejo",
    ],
  },
  { name: "Chaco", aliases: ["chaco", "resistencia"] },
  { name: "Chubut", aliases: ["chubut", "rawson"] },
  { name: "Córdoba", aliases: ["cordoba"] },
  { name: "Corrientes", aliases: ["corrientes"] },
  { name: "Entre Ríos", aliases: ["entre rios", "parana"] },
  { name: "Formosa", aliases: ["formosa"] },
  { name: "Jujuy", aliases: ["jujuy", "san salvador de jujuy"] },
  { name: "La Pampa", aliases: ["la pampa", "santa rosa"] },
  { name: "La Rioja", aliases: ["la rioja"] },
  { name: "Mendoza", aliases: ["mendoza"] },
  { name: "Misiones", aliases: ["misiones", "posadas"] },
  { name: "Neuquén", aliases: ["neuquen"] },
  { name: "Río Negro", aliases: ["rio negro", "viedma"] },
  { name: "Salta", aliases: ["salta"] },
  { name: "San Juan", aliases: ["san juan"] },
  { name: "San Luis", aliases: ["san luis"] },
  { name: "Santa Cruz", aliases: ["santa cruz", "rio gallegos"] },
  { name: "Santa Fe", aliases: ["santa fe"] },
  {
    name: "Santiago del Estero",
    aliases: ["santiago del estero"],
  },
  {
    name: "Tierra del Fuego",
    aliases: [
      "tierra del fuego",
      "tierra del fuego antartida e islas del atlantico sur",
      "ushuaia",
    ],
  },
  {
    name: "Tucumán",
    aliases: ["tucuman", "san miguel de tucuman"],
  },
] as const;

export function normalizeGeoText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b(provincia|province|prov)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsLocationAlias(text: string, alias: string) {
  return text === alias || ` ${text} `.includes(` ${alias} `);
}

/**
 * Devuelve el nombre canónico de una provincia argentina a partir de una
 * provincia, capital o texto de zona. CABA se evalúa antes que Buenos Aires
 * para que ambas jurisdicciones no se mezclen.
 */
export function resolveArgentineProvince(value?: string | null) {
  const normalized = normalizeGeoText(value);
  if (!normalized) return null;

  for (const province of ARGENTINE_PROVINCES) {
    const aliases = province.aliases
      .map(normalizeGeoText)
      .sort((a, b) => b.length - a.length);
    if (aliases.some((alias) => containsLocationAlias(normalized, alias))) {
      return province.name;
    }
  }

  return null;
}

export function sameProvince(
  candidate?: string | null,
  target?: string | null,
) {
  const candidateProvince = resolveArgentineProvince(candidate);
  const targetProvince = resolveArgentineProvince(target);

  if (candidateProvince && targetProvince) {
    return candidateProvince === targetProvince;
  }

  const candidateNormalized = normalizeGeoText(candidate);
  const targetNormalized = normalizeGeoText(target);
  if (!candidateNormalized || !targetNormalized) return false;

  return (
    candidateNormalized === targetNormalized ||
    candidateNormalized.includes(targetNormalized) ||
    targetNormalized.includes(candidateNormalized)
  );
}

export function sameLocality(
  candidate?: string | null,
  target?: string | null,
) {
  const candidateNormalized = normalizeGeoText(candidate);
  const targetNormalized = normalizeGeoText(target);
  if (!candidateNormalized || !targetNormalized) return false;

  return (
    candidateNormalized === targetNormalized ||
    candidateNormalized.includes(targetNormalized) ||
    targetNormalized.includes(candidateNormalized)
  );
}

export function getProvinceFromLocation(location?: LocationParts | null) {
  return (
    resolveArgentineProvince(location?.provincia) ||
    resolveArgentineProvince(location?.ciudad) ||
    resolveArgentineProvince(location?.localidad)
  );
}

/**
 * Segmentación estricta: si conocemos la provincia del cliente, el prestador
 * debe pertenecer a esa provincia. Si solo conocemos la ciudad, se usa la
 * ciudad como alcance. Sin ubicación, no se ocultan resultados.
 */
export function providerMatchesLocation(
  provider: LocationParts,
  target?: LocationParts | null,
) {
  const targetProvince = getProvinceFromLocation(target);
  const targetCity = target?.ciudad || target?.localidad;

  if (targetProvince) {
    const providerLocation = [
      provider.provincia,
      provider.ciudad,
      provider.localidad,
      provider.barrio,
    ]
      .filter(Boolean)
      .join(", ");
    return sameProvince(providerLocation, targetProvince);
  }

  if (targetCity) {
    return [provider.ciudad, provider.localidad, provider.barrio].some((part) =>
      sameLocality(part, targetCity),
    );
  }

  return true;
}

export function formatLocationScope(location?: LocationParts | null) {
  const province = getProvinceFromLocation(location);
  const city = location?.ciudad || location?.localidad;

  if (province && city && !sameLocality(city, province)) {
    return `${city}, ${province}`;
  }

  return province || city || null;
}
