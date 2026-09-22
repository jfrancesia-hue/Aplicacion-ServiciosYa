import type { QueryClient } from "@tanstack/react-query";

export function clearServicesCache(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ["user", "services"] });
}
