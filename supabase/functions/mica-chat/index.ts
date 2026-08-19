declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type MicaMode =
  | "buscar-servicio"
  | "ofrecer-servicio"
  | "b2b"
  | "intermediar-chat";

type ChatMessage = {
  author: "mica" | "user";
  text: string;
};

type MicaRequest = {
  mode: MicaMode;
  message: string;
  insight?: Record<string, string | undefined>;
  knownLocation?: string | null;
  history?: ChatMessage[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const modeInstructions: Record<MicaMode, string> = {
  "buscar-servicio":
    "Ayudas a clientes a describir un problema del hogar o empresa y conseguir presupuestos. Tenes que sonar humano, directo y calido, como un buen operador experto. No digas que sos bot ni repitas tu nombre. Junta rubro, problema, zona, urgencia, disponibilidad y fotos si sirven. No inventes profesionales ni precios reales.",
  "ofrecer-servicio":
    "Ayudas a prestadores a inscribirse en SolucionesYa. Sonas como una persona del equipo: clara, practica y motivadora. Junta rubro, zona, experiencia, celular, documentacion, fotos, precios orientativos y disponibilidad. No prometas aprobacion automatica.",
  b2b: "Ayudas a inmobiliarias, consorcios y empresas a usar SolucionesYa B2B. Sonas ejecutivo pero cercano. Junta tipo de organizacion, cantidad de unidades, rubros frecuentes, urgencias, responsables, forma de aprobacion y canal de seguimiento.",
  "intermediar-chat":
    "Sos MICA, intermediaria neutral dentro de un chat entre cliente y prestador. Ayudas a resumir acuerdos, interpretar transcripciones de audio, detectar datos pendientes y proponer el proximo paso dentro de ServiciosYa. No tomes partido, no inventes precios, pagos, fechas ni confirmaciones. No repitas telefonos, enlaces ni datos de contacto externos aunque aparezcan en el historial. Diferencia claramente hechos acordados de puntos pendientes y recorda que ambas personas deben confirmar. Una transcripcion automatica es evidencia provisoria: precio, alcance, materiales, fecha, horario y direccion siempre quedan pendientes si solo aparecen en un audio. Para considerarlos acordados, pedi que cliente y prestador escriban una confirmacion explicita dentro del chat. Nunca afirmes que un pago esta aprobado: ese estado solo lo confirma el sistema de pagos.",
};

const validModes = new Set<MicaMode>([
  "buscar-servicio",
  "ofrecer-servicio",
  "b2b",
  "intermediar-chat",
]);

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

type OpenAIResponse = {
  output_text?: unknown;
  output?: Array<{ content?: Array<{ text?: unknown }> }>;
};

function extractText(response: OpenAIResponse) {
  if (typeof response?.output_text === "string") return response.output_text;

  const parts: string[] = [];
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }

  return parts.join("\n").trim();
}

function buildInput(body: MicaRequest) {
  const recentHistory = (body.history ?? []).slice(-20).map((message) => ({
    role: message.author === "user" ? "user" : "assistant",
    content: message.text,
  }));

  return [
    ...recentHistory,
    {
      role: "user",
      content: [
        `Modo: ${body.mode}`,
        `Mensaje actual: ${body.message}`,
        `Datos ya detectados: ${JSON.stringify(body.insight ?? {})}`,
        `Ubicación ya conocida: ${body.knownLocation?.trim() || "ninguna"}`,
        "Responde SOLO JSON valido con esta forma:",
        `{"reply":"texto natural para el usuario","insightPatch":{"service":"...","location":"...","urgency":"...","timeframe":"...","issue":"...","coverage":"...","experience":"...","price":"...","companyType":"...","units":"...","contactIntent":"..."},"readyForNextStep":false}`,
      ].join("\n"),
    },
  ];
}

function buildLocalIntermediaryReply(body: MicaRequest) {
  const history = body.history ?? [];
  const hasUntranscribedAudio = history.some((message) =>
    message.text.toLowerCase().includes("audio sin transcripción"),
  );
  const question = body.message.toLowerCase();
  const intro = question.includes("resum")
    ? `Revisé ${history.length} mensajes recientes.`
    : "Para avanzar de forma segura dentro de ServiciosYa:";
  const audioNote = hasUntranscribedAudio
    ? "\n\nHay al menos un audio que todavía no pude interpretar. Conviene confirmar ese dato por escrito."
    : "";

  return [
    intro,
    "",
    "ACORDADO",
    "• Todavía no puedo afirmar acuerdos sin confirmación explícita de ambas partes.",
    "",
    "PENDIENTE",
    "• Confirmen el alcance exacto del trabajo.",
    "• Dejen por escrito el precio final y qué materiales incluye.",
    "• Dejen por escrito fecha, franja horaria, dirección y garantía.",
    "",
    "PRÓXIMO PASO",
    "• Cada persona debe escribir CONFIRMO junto con precio, alcance, fecha y dirección.",
    "• Usen el presupuesto y la confirmación dentro de la app.",
    "• Cuando ambos confirmen esos puntos por escrito, coordinen la visita desde este chat.",
    audioNote,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildLocalFallbackResponse(body: MicaRequest) {
  const insightPatch: Record<string, string> = {};
  const insight = body.insight ?? {};
  const knownLocation =
    body.knownLocation?.trim() || insight.location?.trim() || "";

  if (knownLocation && !insight.location?.trim()) {
    insightPatch.location = knownLocation;
  }

  const has = (field: string) =>
    Boolean(insight[field]?.trim() || insightPatch[field]?.trim());

  const pendingByMode: Record<
    Exclude<MicaMode, "intermediar-chat">,
    Array<{ field: string; question: string }>
  > = {
    "buscar-servicio": [
      { field: "service", question: "¿Qué tipo de profesional necesitás?" },
      {
        field: "issue",
        question: "Contame brevemente qué problema hay que resolver.",
      },
      {
        field: "location",
        question: "¿En qué ciudad o barrio hay que hacer el trabajo?",
      },
      {
        field: "urgency",
        question: "¿Es urgente o puede coordinarse para otro día?",
      },
      {
        field: "timeframe",
        question: "¿Qué día u horario te queda mejor?",
      },
    ],
    "ofrecer-servicio": [
      { field: "service", question: "¿Qué oficio o servicio ofrecés?" },
      { field: "location", question: "¿En qué zonas trabajás?" },
      {
        field: "experience",
        question: "¿Cuánta experiencia tenés en ese trabajo?",
      },
      {
        field: "price",
        question: "¿Cómo preferís indicar tus precios orientativos?",
      },
    ],
    b2b: [
      {
        field: "companyType",
        question: "¿Qué tipo de empresa u organización representás?",
      },
      {
        field: "units",
        question: "¿Cuántas unidades o sucursales necesitás cubrir?",
      },
      { field: "coverage", question: "¿En qué zonas necesitás cobertura?" },
      {
        field: "service",
        question: "¿Qué rubros necesitás contratar con más frecuencia?",
      },
    ],
  };

  const pending = pendingByMode[body.mode as Exclude<MicaMode, "intermediar-chat">]
    .find(({ field }) => !has(field));
  const readyForNextStep = !pending;
  const locationAcknowledgement = knownLocation
    ? `Perfecto, tomo ${knownLocation} como ubicación. `
    : "";
  const reply = pending
    ? `${locationAcknowledgement}${pending.question}`
    : body.mode === "buscar-servicio"
      ? "Listo, ya tengo los datos necesarios. Podés pedir presupuestos para publicar el trabajo."
      : body.mode === "ofrecer-servicio"
        ? "Listo, ya tengo la información principal. Podés continuar con la publicación de tu servicio."
        : "Listo, ya tengo los datos principales para continuar con la propuesta B2B.";

  return { reply, insightPatch, readyForNextStep, fallback: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as MicaRequest;
    if (!body?.mode || !validModes.has(body.mode) || !body?.message?.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing mode or message" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey && body.mode === "intermediar-chat") {
      return new Response(
        JSON.stringify({
          reply: buildLocalIntermediaryReply(body),
          fallback: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!apiKey) {
      return new Response(JSON.stringify(buildLocalFallbackResponse(body)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions: [
          modeInstructions[body.mode],
          "Escribi en español rioplatense, sin sonar robotico.",
          "Hace una sola pregunta concreta por turno cuando falten datos.",
          "Toma como validos los datos ya detectados y la ubicacion conocida. No vuelvas a preguntar un dato que ya esta presente.",
          "Si ya hay datos suficientes, explica el siguiente paso sin inventar datos externos.",
          "No pidas datos sensibles innecesarios. No des asesoramiento legal, medico o financiero especializado.",
          body.mode === "intermediar-chat"
            ? "Tu respuesta sera visible para cliente y prestador. Usa listas breves y separa Acordado, Pendiente y Proximo paso solo cuando ayude."
            : "",
        ].join("\n"),
        input: buildInput(body),
        max_output_tokens: 650,
      }),
    });

    const responseJson = await openaiResponse.json();
    if (!openaiResponse.ok) {
      return new Response(
        JSON.stringify({
          error: responseJson?.error?.message ?? "OpenAI request failed",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const text = extractText(responseJson);
    const parsed = safeJsonParse(text);

    if (!parsed?.reply) {
      return new Response(
        JSON.stringify({
          reply: text || "Dale, contame un poco mas para ayudarte mejor.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        reply: parsed.reply,
        insightPatch: parsed.insightPatch ?? {},
        readyForNextStep: Boolean(parsed.readyForNextStep),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
