export type ProviderProfileInput = {
  nombre?: unknown;
  email?: unknown;
  celular?: unknown;
  categoria?: unknown;
  provincia?: unknown;
  ciudad?: unknown;
  foto_perfil?: unknown;
  descripcion?: unknown;
  experiencia?: unknown;
  horarios?: unknown;
};

const FIELD_LABELS: Record<string, string> = {
  nombre: "nombre",
  email: "email válido",
  celular: "celular",
  especialidad: "especialidad",
  provincia: "provincia",
  ciudad: "ciudad",
  foto: "foto de perfil",
  descripcion: "presentación profesional",
  experiencia: "experiencia",
  horarios: "horarios disponibles",
};

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasCategory(value: unknown) {
  if (Array.isArray(value)) return value.some(hasText);
  return hasText(value);
}

export function getProviderProfileCompleteness(
  profile?: ProviderProfileInput | null,
) {
  const checks = [
    { code: "nombre", weight: 15, complete: hasText(profile?.nombre) },
    {
      code: "email",
      weight: 10,
      complete:
        hasText(profile?.email) &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(profile?.email).trim()),
    },
    {
      code: "celular",
      weight: 15,
      complete: String(profile?.celular ?? "").replace(/\D/g, "").length >= 8,
    },
    {
      code: "especialidad",
      weight: 15,
      complete: hasCategory(profile?.categoria),
    },
    { code: "provincia", weight: 10, complete: hasText(profile?.provincia) },
    { code: "ciudad", weight: 10, complete: hasText(profile?.ciudad) },
    { code: "foto", weight: 10, complete: hasText(profile?.foto_perfil) },
    { code: "descripcion", weight: 5, complete: hasText(profile?.descripcion) },
    { code: "experiencia", weight: 5, complete: hasText(profile?.experiencia) },
    { code: "horarios", weight: 5, complete: hasText(profile?.horarios) },
  ];
  const missingCodes = checks
    .filter((item) => !item.complete)
    .map((item) => item.code);
  return {
    score: checks.reduce(
      (total, item) => total + (item.complete ? item.weight : 0),
      0,
    ),
    missingCodes,
    missingLabels: missingCodes.map((code) => FIELD_LABELS[code] ?? code),
  };
}
