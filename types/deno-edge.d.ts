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

declare module "npm:@anthropic-ai/sdk@0.72.0" {
  type MessageInput = {
    model: string;
    max_tokens: number;
    system?: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };

  type MessageContent =
    | { type: "text"; text: string }
    | { type: "thinking"; thinking: string };

  export default class Anthropic {
    constructor(options: { apiKey: string });
    messages: {
      create(input: MessageInput): Promise<{ content: MessageContent[] }>;
    };
  }
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: unknown,
    // biome-ignore lint/suspicious/noExplicitAny: Minimal shim for the external Deno module, whose types are resolved remotely at deploy time.
  ): any;
}
