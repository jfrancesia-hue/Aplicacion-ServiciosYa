const headers = { "Content-Type": "application/json" };

Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: "retired_function",
      replacement: "process-transactional-notifications",
    }),
    { status: 410, headers },
  ),
);
