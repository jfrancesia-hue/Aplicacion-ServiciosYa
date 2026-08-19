declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

declare module "npm:@supabase/supabase-js@2" {
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: unknown,
    // biome-ignore lint/suspicious/noExplicitAny: Minimal shim for the external Deno module, whose types are resolved remotely at deploy time.
  ): any;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: unknown,
    // biome-ignore lint/suspicious/noExplicitAny: Minimal shim for the external Deno module, whose types are resolved remotely at deploy time.
  ): any;
}
