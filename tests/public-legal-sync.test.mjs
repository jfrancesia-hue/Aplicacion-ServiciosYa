import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CURRENT_LEGAL_DOCUMENT_SET,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  LEGAL_TERMS_URL,
  PRIVACY_POLICY_URL,
} from "../lib/constants/legal.ts";
import { LEGAL_DOCUMENTS } from "../lib/legal/documents.ts";

const publicPayload = JSON.parse(
  await readFile(new URL("../website/legal-documents.json", import.meta.url)),
);

test("la copia web se genera desde los documentos legales vigentes", () => {
  assert.equal(publicPayload.documentSet, CURRENT_LEGAL_DOCUMENT_SET);
  assert.equal(publicPayload.publicUrls.terms, LEGAL_TERMS_URL);
  assert.equal(publicPayload.publicUrls.privacy, PRIVACY_POLICY_URL);
  assert.deepEqual(publicPayload.documents, LEGAL_DOCUMENTS);
  assert.equal(publicPayload.documents.terms.version, CURRENT_TERMS_VERSION);
  assert.equal(publicPayload.documents.privacy.version, CURRENT_PRIVACY_VERSION);
});

test("la publicación identifica al operador y separa ambos documentos", () => {
  assert.equal(publicPayload.operator.legalName, "TORI SERVICIOS S.A.S.");
  assert.match(publicPayload.operator.taxId, /30-71884004-6/);
  assert.match(
    publicPayload.documents.terms.summary,
    /comisión del 10%/i,
  );
  assert.match(
    publicPayload.documents.privacy.title,
    /^Política de Privacidad de Servicios Ya$/,
  );
  assert.doesNotMatch(
    publicPayload.documents.privacy.sections[0].title,
    /términos/i,
  );
});
