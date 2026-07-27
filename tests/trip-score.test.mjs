import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/lib/trip-score.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const compiledModule = { exports: {} };
vm.runInNewContext(compiled, {
  module: compiledModule,
  exports: compiledModule.exports,
});

const {
  calculateTripScore,
  isBetterScore,
  normalizeTravelPreferences,
  preferencesFor,
} = compiledModule.exports;

function day(overrides = {}) {
  return {
    date: "2026-08-01",
    weatherCode: 0,
    temperatureMax: 26,
    temperatureMin: 20,
    apparentTemperatureMax: 26,
    apparentTemperatureMin: 20,
    sunrise: "2026-08-01T05:30",
    sunset: "2026-08-01T20:30",
    uvIndexMax: 6,
    precipitation: 0,
    precipitationProbability: 5,
    windSpeedMax: 15,
    windGustsMax: 24,
    ...overrides,
  };
}

test("travel presets produce an excellent fit when conditions match", () => {
  const score = calculateTripScore([day()], [], preferencesFor("beach"));
  assert.ok(score);
  assert.equal(score.label, "Excellent");
  assert.ok(score.value >= 85);
});

test("personal tolerances and factor weights change the trip score", () => {
  const wetDay = day({ precipitation: 18, precipitationProbability: 90 });
  const relaxed = preferencesFor("city");
  relaxed.precipitationTolerance = 25;
  relaxed.weights.rain = 1;
  const strict = preferencesFor("city");
  strict.precipitationTolerance = 2;
  strict.weights.rain = 3;
  const relaxedScore = calculateTripScore([wetDay], [], relaxed);
  const strictScore = calculateTripScore([wetDay], [], strict);
  assert.ok(relaxedScore && strictScore);
  assert.ok(relaxedScore.value > strictScore.value);
});

test("weather risks reduce a score and become a visible reason", () => {
  const preferences = preferencesFor("city");
  const clear = calculateTripScore([day()], [], preferences);
  const risky = calculateTripScore(
    [day()],
    [{ id: "storm", level: "caution", title: "Thunderstorms possible", detail: "Stay flexible", date: "2026-08-01" }],
    preferences,
  );
  assert.ok(clear && risky);
  assert.ok(risky.value < clear.value);
  assert.ok(risky.reasons.some((reason) => reason.factor === "risk"));
});

test("unavailable days do not fabricate a trip score", () => {
  assert.equal(calculateTripScore([], [], preferencesFor("outdoors")), null);
});

test("tie breaking prefers fewer caution risks and then less rain", () => {
  const higherRisk = { value: 80, label: "Good", reasons: [], cautionCount: 1, totalPrecipitation: 2 };
  const drier = { value: 80, label: "Good", reasons: [], cautionCount: 0, totalPrecipitation: 1 };
  assert.equal(isBetterScore(drier, higherRisk), true);
});

test("malformed stored preferences safely fall back to a valid profile", () => {
  const preferences = normalizeTravelPreferences({
    style: "beach",
    temperatureMin: "hot",
    temperatureMax: -100,
    precipitationTolerance: -4,
    weights: { rain: 99 },
  });
  assert.equal(preferences.style, "beach");
  assert.ok(preferences.temperatureMax > preferences.temperatureMin);
  assert.equal(preferences.precipitationTolerance, 0);
  assert.equal(preferences.weights.rain, 2);
});
