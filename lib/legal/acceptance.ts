import {
  CURRENT_LEGAL_DOCUMENT_SET,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "../constants/legal";
import { supabase } from "../supabase";

export type LegalAcceptanceSource =
  | "client_registration"
  | "provider_registration"
  | "profile_completion"
  | "account_update";

export async function recordCurrentLegalAcceptance(
  source: LegalAcceptanceSource,
) {
  const { error } = await supabase.rpc("accept_current_legal_documents", {
    p_document_set: CURRENT_LEGAL_DOCUMENT_SET,
    p_terms_version: CURRENT_TERMS_VERSION,
    p_privacy_version: CURRENT_PRIVACY_VERSION,
    p_source: source,
  });

  if (error) throw error;
}
