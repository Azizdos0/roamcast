import { getWeather, locationId } from "../../lib/weather";
import type { Location } from "../../types";

function coordinate(
  raw: string | null,
  min: number,
  max: number,
): number | null {
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = coordinate(searchParams.get("lat"), -90, 90);
  const longitude = coordinate(searchParams.get("lon"), -180, 180);
  if (latitude === null || longitude === null) {
    return Response.json(
      {
        error: {
          code: "INVALID_COORDINATES",
          message: "Valid latitude and longitude are required.",
        },
      },
      { status: 400 },
    );
  }

  const location: Location = {
    id: locationId(latitude, longitude),
    name: searchParams.get("name")?.slice(0, 80) || "Your location",
    country: searchParams.get("country")?.slice(0, 80) || "",
    region: searchParams.get("region")?.slice(0, 80) || undefined,
    latitude,
    longitude,
  };

  try {
    const weather = await getWeather(location, 10);
    return Response.json(weather, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return Response.json(
      {
        error: {
          code: "WEATHER_SERVICE_UNAVAILABLE",
          message: "Live weather is temporarily unavailable.",
        },
      },
      { status: 503 },
    );
  }
}

