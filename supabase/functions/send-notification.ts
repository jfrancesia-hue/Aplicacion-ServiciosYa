import { createClient } from "npm:@supabase/supabase-js@2";
 

interface HiredService {
  id: string;
  contratante_id: string;
  contratado_id: string;
  servicio_id: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: HiredService;
  schema: "public";
  old_record: null | HiredService;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  const payload: WebhookPayload = await req.json();
  const { data } = await supabase
    .from("usuarios")
    .select("expo_token")
    .eq("id", payload.record.contratado_id)
    .single();

  const { data: servicio } = await supabase
    .from("servicios")
    .select("titulo")
    .eq("id", payload.record.servicio_id)
    .single();

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}`,
    },
    body: JSON.stringify({
      to: data?.expo_token,
      sound: "default",
      title: "Nuevo Servicio Contratado",
      body: `Has sido contratado para el servicio: ${servicio?.titulo}`,
      data: JSON.stringify({ screen: "NotificacionesScreen", params: {} }),
    }),
  }).then((res) => res.json());

  return new Response(JSON.stringify(res), {
    headers: { "Content-Type": "application/json" },
  });
});
