import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildQuotePricing,
  calculateQuoteReferenceTotal,
} from "../lib/utils/quotePricing.ts";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260812120000_manual_service_requests_and_applications.sql",
    import.meta.url,
  ),
  "utf8",
);
const publicationScreen = await readFile(
  new URL("../screens/PublicarNecesidad.tsx", import.meta.url),
  "utf8",
);
const workerHome = await readFile(
  new URL("../components/home/WorkerHomeView.tsx", import.meta.url),
  "utf8",
);
const pricingMigration = await readFile(
  new URL(
    "../supabase/migrations/20260812130000_quote_pricing_modes.sql",
    import.meta.url,
  ),
  "utf8",
);
const paymentPreference = await readFile(
  new URL(
    "../supabase/functions/create-payment-preference/index.ts",
    import.meta.url,
  ),
  "utf8",
);

test("las publicaciones manuales reutilizan nuevaOferta con un origen distinguible", () => {
  assert.match(migration, /create_manual_service_request/);
  assert.match(migration, /'manual_app'/);
  assert.match(migration, /insert into public\."nuevaOferta"/);
  assert.match(publicationScreen, /createManualServiceRequest/);
});

test("cada cliente solo lista y cancela publicaciones propias", () => {
  assert.match(migration, /o\.app_cliente_id = auth\.uid\(\)/);
  assert.match(
    migration,
    /where id::text = p_oferta_id and app_cliente_id = auth\.uid\(\)/,
  );
  assert.match(migration, /REQUEST_ALREADY_CONFIRMED/);
});

test("los prestadores reciben pedidos manuales y de MICA sin duplicarlos", () => {
  assert.match(migration, /in \('mica_app', 'manual_app'\)/);
  assert.match(workerHome, /getWorkerServiceRequests/);
  assert.match(workerHome, /new Map<string, any>/);
  assert.match(workerHome, /respondToMicaOrder/);
});

test("calcula el total comisionable para proyecto, hora y día", () => {
  assert.equal(calculateQuoteReferenceTotal("project", 25000, 99), 25000);
  assert.equal(calculateQuoteReferenceTotal("hour", 8000, 3.5), 28000);
  assert.equal(calculateQuoteReferenceTotal("day", 45000, 2), 90000);
  assert.deepEqual(
    buildQuotePricing({
      pricingMode: "hour",
      unitRate: 10000,
      estimatedUnits: 4,
      referenceType: "cap",
    }),
    {
      pricingMode: "hour",
      unitRate: 10000,
      estimatedUnits: 4,
      referenceType: "cap",
      amount: 40000,
    },
  );
});

test("el backend rechaza totales manipulados y guarda la base del 10%", () => {
  assert.match(pricingMigration, /CHAT_QUOTE_TOTAL_MISMATCH/);
  assert.match(
    pricingMigration,
    /pricing_mode in \('project', 'hour', 'day'\)/,
  );
  assert.match(paymentPreference, /Math\.abs\(amount - submittedAmount\)/);
  assert.match(
    paymentPreference,
    /reference_total_type: pricing\.referenceType/,
  );
});
