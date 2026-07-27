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

test("server-renders all four RoamCast experiences", async () => {
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
      ["/", /Reading the skies/],
      [
        "/destination/lisbon?lat=38.7223&lon=-9.1393&name=Lisbon&country=Portugal",
        /Reading the skies/,
      ],
      ["/compare", /Find your best forecast/],
      ["/saved", /Saved for wherever/],
    ];

    for (const [path, expected] of cases) {
      const response = await fetch(`${origin}${path}`, {
        headers: { accept: "text/html" },
      });
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
      const html = await response.text();
      assert.match(html, /RoamCast/);
      assert.match(html, expected);
      assert.match(html, /Search destinations/);
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
  } finally {
    server.kill();
  }
});

test("ships the planned storage, access, and travel-risk contracts", async () => {
  const [client, provider, layout, stylesheet, packageJson] = await Promise.all([
    readFile(new URL("../app/components/RoamCastApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/weather.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(client, /roamcast:v2/);
  assert.match(client, /LEGACY_STORAGE_KEY/);
  assert.match(client, /TravelPreferencesPanel/);
  assert.match(client, /Trip Score unavailable/);
  assert.match(client, /compare\?trip=/);
  assert.match(client, /navigator\.geolocation/);
  assert.match(client, /role="combobox"/);
  assert.match(client, /\.slice\(0, 8\)/);
  assert.match(client, /Live forecast not available yet/);

  assert.match(provider, /apparentTemperatureMax >= 40/);
  assert.match(provider, /windGustsMax >= 50/);
  assert.match(provider, /precipitation >= 25/);
  assert.match(provider, /temperatureMin <= 0/);
  assert.match(provider, /weatherCode >= 95/);
  assert.match(provider, /Math\.min\(16, forecastDays\)/);

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
