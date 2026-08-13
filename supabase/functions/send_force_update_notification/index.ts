export const config = {
  verify_jwt: false,
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_API_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK_SIZE = 100;

// 🔥 MENSAJE ÚNICO DE FORCE UPDATE
const FORCE_UPDATE_MESSAGE = {
  id: 999,
  title: "⚠️ Actualización requerida",
  body: "Hay una nueva versión de ServiciosYa. Actualizá la app para seguir usándola."
};

function chunkArray(array: any[], chunkSize: number) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN");

  if (!SUPABASE_URL || !SUPABASE_KEY || !EXPO_ACCESS_TOKEN) {
    return new Response("Missing env vars", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // ------------------------------------------------------------------
    // 1️⃣ USAMOS EL MISMO RPC QUE YA FUNCIONA
    // ------------------------------------------------------------------
    const { data: users, error } = await supabase.rpc(
      "get_marketing_candidate_users",
      {
        limit_count: 5000, // 🔥 más alto para force update
        days_ago: 0,       // 🔥 no importa si ya recibió algo
      }
    );

    if (error) throw error;

    if (!users || users.length === 0) {
      return Response.json({ success: true, message: "No users to notify" });
    }

    const validUsers = users.filter(
      (u: any) => u.expo_token && u.expo_token.trim() !== ""
    );

    if (validUsers.length === 0) {
      return Response.json({ success: true, message: "No valid tokens" });
    }

    // ------------------------------------------------------------------
    // 2️⃣ ARMAR NOTIFICACIONES
    // ------------------------------------------------------------------
    const notifications = validUsers.map((user: any) => ({
      to: user.expo_token,
      sound: "default",
      title: FORCE_UPDATE_MESSAGE.title,
      body: FORCE_UPDATE_MESSAGE.body,
      data: {
        type: "force_update",
      },
    }));

    // ------------------------------------------------------------------
    // 3️⃣ ENVIAR A EXPO
    // ------------------------------------------------------------------
    let sent = 0;
    let failed = 0;
    const tokensToDeactivate: string[] = [];

    const chunks = chunkArray(notifications, EXPO_CHUNK_SIZE);

    for (const chunk of chunks) {
      const res = await fetch(EXPO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${EXPO_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        failed += chunk.length;
        continue;
      }

      const json = await res.json();

      json.data.forEach((ticket: any, index: number) => {
        if (ticket.status === "ok") {
          sent++;
        } else {
          failed++;
          if (ticket.details?.error === "DeviceNotRegistered") {
            tokensToDeactivate.push(chunk[index].to);
          }
        }
      });
    }

    // ------------------------------------------------------------------
    // 4️⃣ LIMPIAR TOKENS INVÁLIDOS (MISMO COMPORTAMIENTO)
    // ------------------------------------------------------------------
    if (tokensToDeactivate.length > 0) {
      await supabase
        .from("users") // ⚠️ si esto ya estaba en la otra función, dejalo igual
        .update({ expo_token: null })
        .in("expo_token", tokensToDeactivate);
    }

    return Response.json({
      success: true,
      total_users: users.length,
      valid_tokens: validUsers.length,
      sent,
      failed,
    });
  } catch (err: any) {
    console.error("Force update error:", err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
});
