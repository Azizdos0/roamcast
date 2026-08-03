import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

async function loadTypescriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports });
  return compiledModule.exports;
}

const {
  calculateWeatherWindows,
  packingSuggestions,
  activityForDate,
  normalizeActivityPlan,
} = await loadTypescriptModule("../app/lib/weather-window.ts");

const preferences = {
  style: "city",
  temperatureMin: 16,
  temperatureMax: 28,
  precipitationTolerance: 5,
  windGustTolerance: 35,
  uvTolerance: 7,
  preferredCondition: "balanced",
  weights: { temperature: 2, rain: 2, wind: 2, uv: 2, conditions: 2 },
};

function day(overrides = {}) {
  return {
    date: "2026-08-03",
    weatherCode: 1,
    temperatureMax: 26,
    temperatureMin: 18,
    apparentTemperatureMax: 27,
    apparentTemperatureMin: 18,
    sunrise: "2026-08-03T06:00",
    sunset: "2026-08-03T20:00",
    uvIndexMax: 6,
    precipitation: 0,
    precipitationProbability: 5,
    windSpeedMax: 14,
    windGustsMax: 22,
    ...overrides,
  };
}

function hours(overrides = {}) {
  return Array.from({ length: 15 }, (_, index) => ({
    time: `2026-08-03T${String(index + 6).padStart(2, "0")}:00`,
    temperature: 22,
    apparentTemperature: 23,
    uvIndex: index > 4 && index < 9 ? 7 : 2,
    precipitationProbability: 5,
    precipitation: 0,
    weatherCode: 1,
    cloudCover: 20,
    visibility: 12000,
    windSpeed: 12,
    windGusts: 20,
    ...overrides,
  }));
}

test("selects up to three non-overlapping local activity windows", () => {
  const windows = calculateWeatherWindows(hours(), day(), preferences, "sightseeing");
  assert.equal(windows.length, 3);
  assert.ok(windows[0].score >= 70);
  assert.ok(windows.every((window) => window.end > window.start));
  assert.ok(windows[0].end <= windows[1].start || windows[1].end <= windows[0].start);
});

test("poor weather creates a caution window instead of fabricating a good one", () => {
  const windows = calculateWeatherWindows(
    hours({ apparentTemperature: 43, precipitationProbability: 95, precipitation: 6, windGusts: 65, weatherCode: 95 }),
    day({ weatherCode: 95, precipitation: 30, windGustsMax: 65 }),
    preferences,
    "hiking",
  );
  assert.ok(windows.length > 0);
  assert.equal(windows[0].caution, true);
  assert.equal(windows[0].label, "Poor fit");
});

test("activity override precedence is day, destination, trip, then style", () => {
  const plan = normalizeActivityPlan({
    defaultActivity: "general",
    destinationOverrides: { lisbon: "beach" },
    dayOverrides: { "lisbon|2026-08-03": "hiking" },
  });
  assert.equal(activityForDate(plan, preferences, "lisbon", "2026-08-03"), "hiking");
  assert.equal(activityForDate(plan, preferences, "lisbon", "2026-08-04"), "beach");
  assert.equal(activityForDate(plan, preferences, "tokyo", "2026-08-04"), "general");
});

test("packing guidance is deduplicated and limited to eight items", () => {
  const suggestions = packingSuggestions(
    [day({ precipitation: 30, uvIndexMax: 10, temperatureMin: -2, apparentTemperatureMax: 40, windGustsMax: 60, weatherCode: 95 })],
    hours({ visibility: 1000 }),
  );
  assert.ok(suggestions.length <= 8);
  assert.equal(new Set(suggestions.map((item) => item.id)).size, suggestions.length);
  assert.ok(suggestions.some((item) => item.id === "rain"));
  assert.ok(suggestions.some((item) => item.id === "freezing"));
});
