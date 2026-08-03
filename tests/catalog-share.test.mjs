import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

async function compile(path, require = () => ({}), extras = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, {
    module: compiledModule,
    exports: compiledModule.exports,
    require,
    TextEncoder,
    TextDecoder,
    btoa,
    atob,
    ...extras,
  });
  return compiledModule.exports;
}

const catalogModule = await compile("../app/lib/destinations.ts");
const scoreModule = await compile("../app/lib/trip-score.ts");
const windowModule = await compile("../app/lib/weather-window.ts");
const shareModule = await compile("../app/lib/share-trip.ts", (path) => {
  if (path === "./trip-score") return scoreModule;
  if (path === "./weather-window") return windowModule;
  throw new Error(`Unexpected module ${path}`);
});
const storageModule = await compile("../app/lib/storage.ts", (path) => {
  if (path === "./trip-score") return scoreModule;
  if (path === "./weather-window") return windowModule;
  throw new Error(`Unexpected module ${path}`);
});

test("catalog contains 60 valid and uniquely identified global destinations", () => {
  const catalog = catalogModule.DESTINATION_CATALOG;
  assert.equal(catalog.length, 60);
  assert.equal(new Set(catalog.map((item) => item.id)).size, 60);
  assert.ok(catalog.every((item) => item.latitude >= -90 && item.latitude <= 90));
  assert.ok(catalog.every((item) => item.longitude >= -180 && item.longitude <= 180));
  assert.ok(catalog.every((item) => item.timezone && item.styles.length > 0));
  assert.equal(new Set(catalog.map((item) => item.catalogRegion)).size, 6);
});

test("shared trip payload round-trips Unicode and normalized planning state", () => {
  const payload = {
    version: 1,
    name: "Reykjavík · 東京",
    locations: [
      { id: "64.1466,-21.9426", name: "Reykjavík", country: "Iceland", latitude: 64.1466, longitude: -21.9426, timezone: "Atlantic/Reykjavik" },
    ],
    startDate: "2026-08-03",
    endDate: "2026-08-06",
    preferences: scoreModule.preferencesFor("outdoors"),
    activityPlan: windowModule.EMPTY_ACTIVITY_PLAN,
  };
  const code = shareModule.encodeSharedTrip(payload);
  const decoded = shareModule.decodeSharedTrip(code);
  assert.ok(decoded);
  assert.equal(decoded.name, payload.name);
  assert.equal(decoded.locations[0].name, "Reykjavík");
  assert.equal(decoded.preferences.style, "outdoors");
});

test("shared trip decoder rejects malformed, oversized, and unsupported values", () => {
  assert.equal(shareModule.decodeSharedTrip("not-valid!"), null);
  assert.equal(shareModule.decodeSharedTrip("a".repeat(4097)), null);
  const unsupported = btoa(JSON.stringify({ version: 2 })).replace(/=/g, "");
  assert.equal(shareModule.decodeSharedTrip(unsupported), null);
});

test("v2 storage migrates without losing places, trips, units, or preferences", () => {
  const location = { id: "1.0000,2.0000", name: "Test", country: "Example", latitude: 1, longitude: 2 };
  const migrated = storageModule.normalizeStoredState({
    version: 2,
    unit: "imperial",
    favorites: [{ ...location, savedAt: "2026-08-03T00:00:00Z" }],
    recent: [location],
    compare: [location],
    trips: [{ id: "trip", name: "Test trip", locations: [location], startDate: "2026-08-03", endDate: "2026-08-04", createdAt: "2026-08-01", preferences: scoreModule.preferencesFor("city") }],
    travelPreferences: scoreModule.preferencesFor("beach"),
  });
  assert.equal(migrated.version, 3);
  assert.equal(migrated.unit, "imperial");
  assert.equal(migrated.favorites.length, 1);
  assert.equal(migrated.trips[0].activityPlan.defaultActivity, "auto");
  assert.equal(migrated.travelPreferences.style, "beach");
});
