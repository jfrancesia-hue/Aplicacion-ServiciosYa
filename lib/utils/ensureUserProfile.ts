import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";

export async function ensureUserProfile(
  user: Pick<User, "id" | "email">,
): Promise<void> {
  if (!user.email) {
    throw new Error("La cuenta autenticada no tiene un correo asociado.");
  }

  const { error } = await supabase.from("usuarios").upsert(
    {
      id: user.id,
      usuario_id: user.id,
      email: user.email.toLowerCase(),
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) throw error;
}
