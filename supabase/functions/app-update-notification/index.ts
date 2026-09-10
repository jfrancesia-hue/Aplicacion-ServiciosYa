const headers = { "Content-Type": "application/json" };

Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: "retired_function",
      replacement: "send_force_update_notification",
    }),
    { status: 410, headers },
  ),
);
