const releaseChannel = (
  process.env.EXPO_PUBLIC_RELEASE_CHANNEL || "production"
)
  .trim()
  .toLowerCase();

if (releaseChannel !== "internal") {
  process.exit(0);
}

const allowProductionForInternal =
  process.env.EXPO_PUBLIC_INTERNAL_USES_PRODUCTION === "true";

const requiredVariables = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];
const missingVariables = requiredVariables.filter(
  (variableName) => !process.env[variableName]?.trim(),
);

if (missingVariables.length > 0 && !allowProductionForInternal) {
  console.error(
    "La build interna fue detenida para no usar Supabase de producción.",
  );
  console.error(
    `Configurá en el environment preview de EAS: ${missingVariables.join(", ")}`,
  );
  console.error(
    "Si Jorge autoriza probar con datos reales, seteá EXPO_PUBLIC_INTERNAL_USES_PRODUCTION=true.",
  );
  process.exit(1);
}

if (missingVariables.length > 0 && allowProductionForInternal) {
  console.warn(
    "Build interna autorizada contra Supabase de producción: no hay Supabase staging configurado.",
  );
  process.exit(0);
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL.trim();
let parsedSupabaseUrl;
try {
  parsedSupabaseUrl = new URL(supabaseUrl);
} catch {
  console.error("EXPO_PUBLIC_SUPABASE_URL no tiene un formato válido.");
  process.exit(1);
}
const hostnameParts = parsedSupabaseUrl.hostname.toLowerCase().split(".");
if (
  parsedSupabaseUrl.protocol !== "https:" ||
  hostnameParts.length !== 3 ||
  hostnameParts[1] !== "supabase" ||
  hostnameParts[2] !== "co"
) {
  console.error("EXPO_PUBLIC_SUPABASE_URL no pertenece a Supabase.");
  process.exit(1);
}

console.log("Entorno interno validado: Supabase de pruebas configurado.");
