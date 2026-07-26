import { getWeather, locationId } from "../../lib/weather";
import type { Location } from "../../types";

function isLocation(value: unknown): value is Location {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Location>;
  return (
    typeof item.name === "string" &&
    typeof item.latitude === "number" &&
    Number.isFinite(item.latitude) &&
    item.latitude >= -90 &&
    item.latitude <= 90 &&
    typeof item.longitude === "number" &&
    Number.isFinite(item.longitude) &&
    item.longitude >= -180 &&
    item.longitude <= 180
  );
}

export async function POST(request: Request) {
  let body: { locations?: unknown[] };
  try {
    body = (await request.json()) as { locations?: unknown[] };
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(body.locations) ||
    body.locations.length < 1 ||
    body.locations.length > 3 ||
    !body.locations.every(isLocation)
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_LOCATIONS",
          message: "Choose between one and three valid destinations.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const snapshots = await Promise.all(
      body.locations.map((place) =>
        getWeather(
          {
            ...place,
            id: locationId(place.latitude, place.longitude),
          },
          16,
        ),
      ),
    );
    return Response.json(
      { snapshots },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return Response.json(
      {
        error: {
          code: "WEATHER_SERVICE_UNAVAILABLE",
          message: "Comparison weather is temporarily unavailable.",
        },
      },
      { status: 503 },
    );
  }
}

