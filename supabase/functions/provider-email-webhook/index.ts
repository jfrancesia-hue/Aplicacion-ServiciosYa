import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();

function base64Bytes(value: string) {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function verifyWebhook(req: Request, body: string, secret: string) {
  const id = req.headers.get("svix-id") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const signatures = (req.headers.get("svix-signature") ?? "")
    .split(" ")
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : ""))
    .filter(Boolean);
  const seconds = Number(timestamp);
  if (
    !id ||
    !Number.isFinite(seconds) ||
    Math.abs(Date.now() / 1000 - seconds) > 300
  )
    return false;
  const encodedSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey(
    "raw",
    base64Bytes(encodedSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${id}.${timestamp}.${body}`),
  );
  let expected = "";
  for (const byte of new Uint8Array(signed))
    expected += String.fromCharCode(byte);
  const expectedBase64 = btoa(expected);
  return signatures.some((signature) => safeEqual(signature, expectedBase64));
}

Deno.serve(async (req) => {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const body = await req.text();
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret || !(await verifyWebhook(req, body, secret))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(body);
  const eventType = String(payload?.type ?? "");
  const emailId = String(payload?.data?.email_id ?? "");
  const mapping: Record<string, { status: string; timestamp?: string }> = {
    "email.delivered": { status: "delivered", timestamp: "delivered_at" },
    "email.opened": { status: "opened", timestamp: "opened_at" },
    "email.clicked": { status: "clicked", timestamp: "clicked_at" },
    "email.bounced": { status: "bounced" },
    "email.complained": { status: "complained" },
  };
  const event = mapping[eventType];
  if (!event || !emailId) return new Response("ok");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey)
    return new Response("Missing configuration", { status: 503 });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const update: Record<string, string> = { status: event.status };
  if (event.timestamp) update[event.timestamp] = new Date().toISOString();
  const { error } = await admin
    .from("provider_profile_reminders")
    .update(update)
    .eq("provider_message_id", emailId);
  return error
    ? new Response("Update failed", { status: 500 })
    : new Response("ok");
});
