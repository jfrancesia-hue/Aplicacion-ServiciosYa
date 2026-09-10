const headers = { "Content-Type": "application/json" };

Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: "retired_function",
      replacement: "provider-reactivation-emails",
    }),
    { status: 410, headers },
  ),
);
