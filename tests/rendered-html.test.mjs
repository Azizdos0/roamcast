import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  return port;
}

async function waitForServer(origin, process) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready (${process.exitCode})`);
    }
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error("Next.js did not become ready within 20 seconds");
}

test("server-renders all RoamCast experiences", async () => {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const nextBin = resolve(projectRoot, "node_modules", "next", "dist", "bin", "next");
  const server = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  try {
    await waitForServer(origin, server);

    const cases = [
      ["/", /Reading the skies/, true],
      [
        "/destination/lisbon?lat=38.7223&lon=-9.1393&name=Lisbon&country=Portugal",
        /Reading the skies/,
        true,
      ],
      ["/explore", /Where should the weather take you/, false],
      ["/compare", /Find your best forecast/, true],
      ["/saved", /Saved for wherever/, true],
      ["/trip/invalid", /trip link is not valid/, false],
    ];

    for (const [path, expected, hasSearch] of cases) {
      const response = await fetch(`${origin}${path}`, {
        headers: { accept: "text/html" },
      });
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
      const html = await response.text();
      assert.match(html, /RoamCast/);
      assert.match(html, expected);
      if (hasSearch) assert.match(html, /Search destinations/);
    }

    const weather = await fetch(`${origin}/api/weather?lat=200&lon=0`);
    assert.equal(weather.status, 400);
    assert.deepEqual((await weather.json()).error.code, "INVALID_COORDINATES");

    const locations = await fetch(`${origin}/api/locations?q=a`);
    assert.equal(locations.status, 400);
    assert.deepEqual((await locations.json()).error.code, "INVALID_QUERY");

    const compare = await fetch(`${origin}/api/compare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locations: [] }),
    });
    assert.equal(compare.status, 400);
    assert.deepEqual((await compare.json()).error.code, "INVALID_LOCATIONS");

    const recommendations = await fetch(`${origin}/api/recommendations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(recommendations.status, 400);
    assert.deepEqual((await recommendations.json()).error.code, "INVALID_REQUEST");
  } finally {
    server.kill();
  }
});

test("ships the planned storage, access, recommendation, sharing, and travel-risk contracts", async () => {
  const [client, provider, storage, layout, stylesheet, packageJson, recommendation, sharing] = await Promise.all([
    readFile(new URL("../app/components/RoamCastApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/weather.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/recommendations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/share-trip.ts", import.meta.url), "utf8"),
  ]);

  assert.match(storage, /roamcast:v3/);
  assert.match(storage, /roamcast:v2/);
  assert.match(storage, /version: 3/);
  assert.match(client, /TravelPreferencesPanel/);
  assert.match(client, /Trip Score unavailable/);
  assert.match(client, /compare\?trip=/);
  assert.match(client, /Share trip/);
  assert.match(client, /navigator\.geolocation/);
  assert.match(client, /role="combobox"/);
  assert.match(storage, /\.slice\(0, 8\)/);
  assert.match(client, /Live forecast not available yet/);

  assert.match(provider, /apparentTemperatureMax >= 40/);
  assert.match(provider, /windGustsMax >= 50/);
  assert.match(provider, /precipitation >= 25/);
  assert.match(provider, /temperatureMin <= 0/);
  assert.match(provider, /weatherCode >= 95/);
  assert.match(provider, /Math\.min\(16, forecastDays\)/);
  assert.match(provider, /getDailyWeatherBatch/);
  assert.match(provider, /uv_index/);

  assert.match(recommendation, /FORECAST_WINDOW_UNAVAILABLE/);
  assert.match(recommendation, /calculateTripScore/);
  assert.match(sharing, /MAX_SHARE_CODE_LENGTH = 4096/);
  assert.match(sharing, /base64/);

  assert.match(layout, /openGraph/);
  assert.match(layout, /\/og\.png/);
  assert.match(
    stylesheet,
    /\.search-row\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*50;/s,
  );
  assert.match(
    stylesheet,
    /\.search-popover\s*\{[^}]*z-index:\s*60;/s,
  );
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
});
