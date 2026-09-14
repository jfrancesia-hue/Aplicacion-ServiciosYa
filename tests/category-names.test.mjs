import assert from "node:assert/strict";
import test from "node:test";
import { uniqueCategoryNames } from "../lib/utils/categoryNames.ts";

test("el selector de publicación no duplica categorías", () => {
  assert.deepEqual(
    uniqueCategoryNames([
      "Plomero",
      " Plomero ",
      "Electricista",
      "electricista",
      "Atención al cliente",
      "Atencion al cliente",
      null,
    ]),
    ["Atención al cliente", "Electricista", "Plomero"],
  );
});
