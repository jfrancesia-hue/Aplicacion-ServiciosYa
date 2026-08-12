import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
