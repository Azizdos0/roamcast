import { searchLocations } from "../../lib/weather";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const language = searchParams.get("language")?.slice(0, 5) || "en";

  if (query.length < 2 || query.length > 80) {
    return Response.json(
      { error: { code: "INVALID_QUERY", message: "Enter 2–80 characters." } },
      { status: 400 },
    );
  }

  try {
    const locations = await searchLocations(query, language);
    return Response.json(
      { locations },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch {
    return Response.json(
      {
        error: {
          code: "LOCATION_SERVICE_UNAVAILABLE",
          message: "Destination search is temporarily unavailable.",
        },
      },
      { status: 503 },
    );
  }
}

