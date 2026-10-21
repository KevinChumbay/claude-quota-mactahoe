import { test } from "node:test";
import assert from "node:assert/strict";
import { levelFor, colorFor, fraction, pctLabel } from "../lib/levels.js";

test("niveles según umbrales", () => {
  assert.equal(levelFor(79.9, 80, 95), 0);
  assert.equal(levelFor(80, 80, 95), 1);
  assert.equal(levelFor(95, 80, 95), 2);
  assert.equal(levelFor(null, 80, 95), 0);
});

test("colores del spec", () => {
  assert.equal(colorFor(0), "#0088FF");
  assert.equal(colorFor(1), "#F3BA4B");
  assert.equal(colorFor(2), "#ED5F5D");
});

test("fracción recortada a 0..1", () => {
  assert.equal(fraction(140), 1);
  assert.equal(fraction(-3), 0);
  assert.equal(fraction(null), 0);
  assert.equal(fraction(25), 0.25);
});

test("etiqueta de porcentaje", () => {
  assert.equal(pctLabel(10.4), "10%");
  assert.equal(pctLabel(104), "104%");
  assert.equal(pctLabel(null), "–");
});
