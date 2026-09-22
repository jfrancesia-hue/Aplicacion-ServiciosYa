import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  SERVICE_CONFIRMATION_COMMISSION_RATE,
  calculateServiceConfirmationFee,
} from "../lib/constants/billing.ts";
import {
  createAudioMessageContent,
  getChatMessagePreview,
  parseAudioMessageContent,
} from "../lib/utils/audioMessage.ts";
import {
  ARGENTINE_PROVINCE_BY_STATE_CODE,
  formatLocationScope,
  getArgentineProvinceCapital,
  providerMatchesLocation,
  resolveArgentineProvince,
  sameProvince,
} from "../lib/utils/geoSegmentation.ts";
import {
  asksForKnownLocation,
  getMicaRequestLocationStatus,
  inferMicaLocation,
  resolveMicaRequestLocation,
} from "../lib/utils/micaLocation.ts";
import {
  createMicaAssistantContent,
  getMicaSystemMessagePreview,
  parseMicaSystemMessage,
} from "../lib/utils/micaMessage.ts";
import {
  createQuoteMessage,
  parseQuoteMessage,
} from "../lib/utils/quoteMessage.ts";
import {
  createServiceSystemContent,
  getServiceSystemMessagePreview,
  parseServiceSystemMessage,
} from "../lib/utils/serviceSystemMessage.ts";
import { repairSpanishMojibake } from "../lib/utils/textEncoding.ts";

const loginSource = fs.readFileSync(
  new URL("../screens/Login.tsx", import.meta.url),
  "utf8",
);
const storageSource = fs.readFileSync(
  new URL("../lib/storage.ts", import.meta.url),
  "utf8",
);
const homeSource = fs.readFileSync(
  new URL("../screens/Home.tsx", import.meta.url),
  "utf8",
);
const notificationsSource = fs.readFileSync(
  new URL("../screens/NotificacionesScreen.tsx", import.meta.url),
  "utf8",
);
const categoryListSource = fs.readFileSync(
  new URL("../components/home/CategoryList.tsx", import.meta.url),
  "utf8",
);
const categoryResultsSource = fs.readFileSync(
  new URL("../screens/ServiciosPorCategoria.tsx", import.meta.url),
  "utf8",
);
const mainNavigationSource = fs.readFileSync(
  new URL("../navigation/MainAppStackNavigator.tsx", import.meta.url),
  "utf8",
);
const notificationHookSource = fs.readFileSync(
  new URL("../lib/hooks/useNotifications.ts", import.meta.url),
  "utf8",
);
const settingsSource = fs.readFileSync(
  new URL("../screens/Configuracion.tsx", import.meta.url),
  "utf8",
);

test("el dispositivo no guarda la contraseña y elimina credenciales legadas", () => {
  assert.doesNotMatch(loginSource, /saveCredentials/);
  assert.doesNotMatch(storageSource, /password:\s*string/);
  assert.doesNotMatch(storageSource, /setItemAsync\([^)]*CREDENTIALS/s);
  assert.match(storageSource, /deleteItemAsync\(STORAGE_KEYS\.CREDENTIALS\)/);
});

test("la operación no depende de la telemetría PHP heredada", () => {
  assert.doesNotMatch(homeSource, /insightpulse\.store/);
  assert.doesNotMatch(notificationsSource, /insightpulse\.store/);
});

test("un fallo geográfico no se disfraza con prestadores nacionales", () => {
  assert.doesNotMatch(categoryListSource, /from\(["']user_public_profiles["']\)/);
  assert.doesNotMatch(categoryResultsSource, /from\(["']user_public_profiles["']\)/);
  assert.match(categoryResultsSource, /No pudimos consultar los prestadores/);
});

test("el binario no conserva pasarelas ni rutas alternativas obsoletas", () => {
  assert.doesNotMatch(mainNavigationSource, /PasarelaPago/);
  assert.doesNotMatch(mainNavigationSource, /OnlineWorkers/);
  assert.doesNotMatch(mainNavigationSource, /DniPendiente/);
  assert.doesNotMatch(homeSource, /ChatBotModal/);
});

test("los permisos sensibles se piden desde una accion explicita", () => {
  assert.match(notificationHookSource, /requestPermission\s*\?/);
  assert.match(notificationHookSource, /initializeNotifications\(false\)/);
  assert.match(settingsSource, /requestPushNotificationPermission/);
  assert.match(settingsSource, /Activar notificaciones/);
});

test("segmenta prestadores de Catamarca sin depender de tildes", () => {
  const target = {
    ciudad: "San Fernando del Valle de Catamarca",
    provincia: "Catamarca",
  };

  assert.equal(
    providerMatchesLocation(
      { ciudad: "Valle Viejo", provincia: "Catamarca" },
      target,
    ),
    true,
  );
  assert.equal(
    providerMatchesLocation(
      { ciudad: "La Rioja", provincia: "La Rioja" },
      target,
    ),
    false,
  );
});
test("no mezcla CABA con provincia de Buenos Aires", () => {
  assert.equal(
    resolveArgentineProvince("Ciudad Autónoma de Buenos Aires"),
    "Ciudad Autónoma de Buenos Aires",
  );
  assert.equal(sameProvince("CABA", "Provincia de Buenos Aires"), false);
});

test("mantiene resultados cuando todavía no existe una ubicación", () => {
  assert.equal(providerMatchesLocation({ provincia: "Catamarca" }, null), true);
  assert.equal(
    formatLocationScope({
      ciudad: "San Fernando del Valle de Catamarca",
      provincia: "Catamarca",
    }),
    "Catamarca",
  );
});

test("serializa audios y conserva la transcripción corregida", () => {
  const content = createAudioMessageContent({
    path: "chat/user/audio.m4a",
    durationMs: 12_400,
    mimeType: "audio/mp4",
    transcript: "Voy mañana a las nueve.",
  });
  const audio = parseAudioMessageContent(content);

  assert.equal(audio?.durationMs, 12_400);
  assert.equal(audio?.transcript, "Voy mañana a las nueve.");
  assert.equal(getChatMessagePreview(content), "🎤 Voy mañana a las nueve.");
});

test("identifica de forma segura los mensajes compartidos por MICA", () => {
  const content = createMicaAssistantContent(
    "Acordado: visita mañana. Pendiente: confirmar materiales.",
    "user-id",
  );
  const message = parseMicaSystemMessage(content);

  assert.equal(message?.kind, "assistant");
  assert.equal(message?.requestedBy, "user-id");
  assert.match(getMicaSystemMessagePreview(content) ?? "", /^MICA:/);
});

test("calcula una reserva del 10% sin retener el precio del trabajo", () => {
  assert.equal(SERVICE_CONFIRMATION_COMMISSION_RATE, 0.1);
  assert.equal(calculateServiceConfirmationFee(100_000), 10_000);
});

test("serializa una propuesta con el desglose autoritativo", () => {
  const content = createQuoteMessage({
    quoteId: "quote-id",
    version: 2,
    amount: 100_000,
    feeRate: 0.1,
    feeAmount: 10_000,
    clientTotal: 110_000,
    scope: "Reparación e instalación",
    materials: "A confirmar",
    timeframe: "48 horas",
    warranty: "30 días",
    validUntil: "24 horas",
  });
  const quote = parseQuoteMessage(content);

  assert.equal(quote?.version, 2);
  assert.equal(quote?.amount, 100_000);
  assert.equal(quote?.feeAmount, 10_000);
  assert.equal(quote?.clientTotal, 110_000);
});

test("los estados de reserva no se presentan como mensajes de MICA", () => {
  const content = createServiceSystemContent({
    kind: "booking_confirmed",
    title: "Reserva confirmada",
    text: "El cargo de reserva fue aprobado.",
    actorId: "client-id",
  });
  const message = parseServiceSystemMessage(content);

  assert.equal(message?.kind, "booking_confirmed");
  assert.match(getServiceSystemMessagePreview(content) ?? "", /^ServiciosYa:/);
  assert.equal(parseMicaSystemMessage(content), null);
});

test("interpreta una resolución de cancelación como evento del servicio", () => {
  const content = createServiceSystemContent({
    kind: "cancellation_rejected",
    title: "Solicitud revisada",
    text: "La reserva continúa activa.",
    eventId: "request-id",
  });
  const message = parseServiceSystemMessage(content);

  assert.equal(message?.kind, "cancellation_rejected");
  assert.equal(message?.eventId, "request-id");
  assert.equal(parseMicaSystemMessage(content), null);
});

test("MICA reconoce ciudades y barrios con tildes sin repetir la pregunta", () => {
  assert.equal(inferMicaLocation("Zona Nueva Córdoba"), "Nueva Córdoba");
  assert.equal(inferMicaLocation("Barrio 9 de Julio"), "Barrio 9 de Julio");
  assert.equal(
    inferMicaLocation("San Fernando del Valle de Catamarca", true),
    "San Fernando del Valle de Catamarca",
  );
  assert.equal(
    asksForKnownLocation(
      "¿En qué ciudad o barrio hay que hacer el trabajo?",
      "Nueva Córdoba",
    ),
    true,
  );
});

test("MICA no publica un barrio ambiguo sin ciudad y provincia", () => {
  assert.deepEqual(
    getMicaRequestLocationStatus({ requestedZone: "Barrio 9 de Julio" }),
    {
      city: null,
      province: null,
      requestedZone: "Barrio 9 de Julio",
      isComplete: false,
      label: null,
      draftLabel: "Barrio 9 de Julio",
    },
  );
});

test("MICA combina el barrio con la ciudad confirmada por GPS o selección manual", () => {
  assert.deepEqual(
    getMicaRequestLocationStatus({
      requestedZone: "Barrio 9 de Julio",
      fallbackCity: "San Fernando del Valle de Catamarca",
      fallbackProvince: "Catamarca",
    }),
    {
      city: "San Fernando del Valle de Catamarca",
      province: "Catamarca",
      requestedZone: "Barrio 9 de Julio",
      isComplete: true,
      label:
        "Barrio 9 de Julio, San Fernando del Valle de Catamarca, Catamarca",
      draftLabel:
        "Barrio 9 de Julio, San Fernando del Valle de Catamarca, Catamarca",
    },
  );
});

test("MICA separa correctamente una ciudad y provincia escritas juntas", () => {
  assert.deepEqual(
    getMicaRequestLocationStatus({
      requestedZone: "San Fernando del Valle de Catamarca, Catamarca",
    }),
    {
      city: "San Fernando del Valle de Catamarca",
      province: "Catamarca",
      requestedZone: "San Fernando del Valle de Catamarca, Catamarca",
      isComplete: true,
      label: "San Fernando del Valle de Catamarca, Catamarca",
      draftLabel: "San Fernando del Valle de Catamarca, Catamarca",
    },
  );
});

test("MICA interpreta Catamarca y Capital usando la provincia detectada", () => {
  assert.deepEqual(
    resolveMicaRequestLocation({
      requestedZone: "Catamarca",
      fallbackCity: "San Fernando del Valle de Catamarca",
      fallbackProvince: "Catamarca",
    }),
    {
      city: "San Fernando del Valle de Catamarca",
      province: "Catamarca",
    },
  );
  assert.deepEqual(
    resolveMicaRequestLocation({
      requestedZone: "Capital",
      fallbackProvince: "Catamarca",
    }),
    {
      city: "San Fernando del Valle de Catamarca",
      province: "Catamarca",
    },
  );
});

test("la segmentación contempla las 24 jurisdicciones argentinas", () => {
  assert.equal(
    new Set(Object.values(ARGENTINE_PROVINCE_BY_STATE_CODE)).size,
    24,
  );
  assert.equal(
    getArgentineProvinceCapital("Catamarca"),
    "San Fernando del Valle de Catamarca",
  );
});

test("repara texto español recibido con codificación incorrecta", () => {
  assert.equal(
    repairSpanishMojibake("Contame quÃ© necesitÃ¡s. Ya enviÃ© tu pedido."),
    "Contame qué necesitás. Ya envié tu pedido.",
  );
});

test("MICA conserva un fallback remoto cuando no hay proveedor de IA", () => {
  const functionSource = fs.readFileSync(
    "supabase/functions/mica-chat/index.ts",
    "utf8",
  );

  assert.match(functionSource, /buildLocalFallbackResponse/);
  assert.match(functionSource, /ANTHROPIC_API_KEY/);
  assert.match(functionSource, /if \(!apiKey \|\| !model\)/);
  assert.doesNotMatch(functionSource, /OPENAI_API_KEY/);
  assert.match(functionSource, /knownLocation/);
  assert.doesNotMatch(functionSource, /OPENAI_API_KEY is not configured/);
});
