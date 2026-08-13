import { supabase } from "../supabase";

export const VERIFICATION_DOCUMENTS_BUCKET = "verification-documents";

export async function resolveVerificationDocumentUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  const { data, error } = await supabase.storage
    .from(VERIFICATION_DOCUMENTS_BUCKET)
    .createSignedUrl(value, 10 * 60);
  if (error) throw error;
  return data.signedUrl;
}
