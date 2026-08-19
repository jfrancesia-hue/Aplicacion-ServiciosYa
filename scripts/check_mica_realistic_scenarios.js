const scenarios = [
  {
    name: "bloquea saludo sin problema real",
    insight: {},
    location: "",
    expectedCanCreate: false,
    expectedMissing: ["issue", "service", "location"],
  },
  {
    name: "permite pedido con zona escrita y sin foto ni horario",
    insight: {
      issue: "Tengo una perdida abajo de la bacha",
      service: "Plomeria",
      location: "Catamarca capital",
    },
    location: "",
    expectedCanCreate: true,
  },
  {
    name: "permite pedido usando GPS cuando el usuario no da zona",
    insight: {
      issue: "No tengo luz en el local desde esta manana",
      service: "Electricidad",
    },
    location: "San Fernando del Valle de Catamarca, Catamarca",
    expectedCanCreate: true,
  },
  {
    name: "permite pedido usando perfil si no hay GPS",
    insight: {
      issue: "Necesito traducir un documento para presentar esta semana",
      service: "Traductor",
    },
    location: "capital, Catamarca",
    expectedCanCreate: true,
  },
  {
    name: "bloquea rubro generico aunque haya ubicacion",
    insight: {
      issue: "Necesito que alguien me ayude con algo en casa",
    },
    location: "Catamarca",
    expectedCanCreate: false,
    expectedMissing: ["service"],
  },
  {
    name: "bloquea pedido sin ubicacion ni fallback",
    insight: {
      issue: "Necesito limpieza urgente de un departamento",
      service: "Limpieza",
      urgency: "Alta",
    },
    location: "",
    expectedCanCreate: false,
    expectedMissing: ["location"],
  },
];

function hasUsableText(value, minLength = 3) {
  return Boolean(value?.trim() && value.trim().length >= minLength);
}

function getSearchReadiness(insight, profileLocation) {
  const hasIssue = hasUsableText(insight.issue, 8);
  const hasService = hasUsableText(insight.service);
  const hasLocation =
    hasUsableText(insight.location) || hasUsableText(profileLocation);
  const missing = [];

  if (!hasIssue) missing.push("issue");
  if (!hasService) missing.push("service");
  if (!hasLocation) missing.push("location");

  return {
    canCreate: missing.length === 0,
    missing,
  };
}

const failures = [];

for (const scenario of scenarios) {
  const actual = getSearchReadiness(scenario.insight, scenario.location);
  const missingOk = scenario.expectedMissing
    ? JSON.stringify(actual.missing) === JSON.stringify(scenario.expectedMissing)
    : true;
  const ok = actual.canCreate === scenario.expectedCanCreate && missingOk;

  console.log(
    `${ok ? "OK" : "FAIL"} ${scenario.name}: canCreate=${actual.canCreate}, missing=${actual.missing.join(",") || "-"}`,
  );

  if (!ok) {
    failures.push({
      name: scenario.name,
      expectedCanCreate: scenario.expectedCanCreate,
      expectedMissing: scenario.expectedMissing,
      actual,
    });
  }
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
