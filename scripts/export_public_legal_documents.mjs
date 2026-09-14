import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CURRENT_LEGAL_DOCUMENT_SET,
  LEGAL_TERMS_URL,
  PRIVACY_POLICY_URL,
} from "../lib/constants/legal.ts";
import { LEGAL_DOCUMENTS } from "../lib/legal/documents.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const argumentsList = process.argv.slice(2);
const checkOnly = argumentsList.includes("--check");
const outputDirectories = [];

for (let index = 0; index < argumentsList.length; index += 1) {
  if (argumentsList[index] === "--output-dir") {
    const outputDirectory = argumentsList[index + 1];
    if (!outputDirectory) {
      throw new Error("--output-dir requiere una ruta");
    }
    outputDirectories.push(path.resolve(outputDirectory));
    index += 1;
  }
}

if (outputDirectories.length === 0) {
  outputDirectories.push(path.join(repositoryRoot, "website"));
}

const publicLegalPayload = {
  schemaVersion: 1,
  source: "lib/legal/documents.ts",
  documentSet: CURRENT_LEGAL_DOCUMENT_SET,
  publicUrls: {
    terms: LEGAL_TERMS_URL,
    privacy: PRIVACY_POLICY_URL,
  },
  operator: {
    legalName: "TORI SERVICIOS S.A.S.",
    taxId: "CUIT 30-71884004-6",
    address:
      "Av. República de China 745, manzana 7, lote 1, ciudad de Córdoba, Provincia de Córdoba, República Argentina",
    businessEmail: "serviciosya@nativosconsultora.com.ar",
    supportEmail: "serviciosya.desarrollador@gmail.com",
  },
  documents: LEGAL_DOCUMENTS,
};

const serializedPayload = `${JSON.stringify(publicLegalPayload, null, 2)}\n`;

for (const outputDirectory of outputDirectories) {
  const outputPath = path.join(outputDirectory, "legal-documents.json");

  if (checkOnly) {
    const currentPayload = await readFile(outputPath, "utf8");
    if (currentPayload !== serializedPayload) {
      throw new Error(
        `${outputPath} no coincide con lib/legal/documents.ts. Ejecutá npm run legal:export-public.`,
      );
    }
    console.log(`Sincronizado: ${outputPath}`);
    continue;
  }

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, serializedPayload, "utf8");
  console.log(`Generado: ${outputPath}`);
}
