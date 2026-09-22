import assert from "node:assert/strict";
import test from "node:test";
import { parseMoneyInput } from "../lib/utils/money.ts";

test("interpreta importes argentinos sin convertir 5.000 en 5", () => {
  assert.equal(parseMoneyInput("5.000"), 5000);
  assert.equal(parseMoneyInput("$ 5.000,50"), 5000.5);
  assert.equal(parseMoneyInput("5000,50"), 5000.5);
});

test("acepta formato internacional y rechaza importes inválidos", () => {
  assert.equal(parseMoneyInput("5,000.50"), 5000.5);
  assert.equal(parseMoneyInput("5000"), 5000);
  assert.equal(parseMoneyInput("0"), null);
  assert.equal(parseMoneyInput("-100"), null);
  assert.equal(parseMoneyInput("abc"), null);
});
