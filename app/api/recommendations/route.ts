import { DESTINATION_CATALOG, DESTINATION_REGIONS } from "../../lib/destinations";
import {
  calculateTripScore,
  isBetterScore,
  normalizeTravelPreferences,
} from "../../lib/trip-score";
import { getDailyWeatherBatch } from "../../lib/weather";
import type {
  DestinationRegion,
  RecommendationRequest,
  RecommendationResponse,
} from "../../types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function dateAt(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function validRegion(value: unknown): value is DestinationRegion | "all" {
  return DESTINATION_REGIONS.some((region) => region.value === value);
}

function error(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let body: Partial<RecommendationRequest>;
  try {
    body = (await request.json()) as Partial<RecommendationRequest>;
  } catch {
    return error("INVALID_REQUEST", "Invalid request body.", 400);
  }
  if (
    !ISO_DATE.test(String(body.startDate)) ||
    !ISO_DATE.test(String(body.endDate)) ||
    !validRegion(body.region) ||
    body.startDate! > body.endDate!
  ) {
    return error(
      "INVALID_REQUEST",
      "Choose valid dates, a region, and travel preferences.",
      400,
    );
  }
  if (
    body.startDate! < dateAt(0) ||
    body.endDate! > dateAt(15)
  ) {
    return error(
      "FORECAST_WINDOW_UNAVAILABLE",
      "Recommendations are available for dates inside the 16-day live forecast window.",
      422,
    );
  }

  const preferences = normalizeTravelPreferences(body.preferences);
  const candidates = DESTINATION_CATALOG.filter(
    (destination) =>
      (body.region === "all" || destination.catalogRegion === body.region) &&
      (preferences.style === "custom" || destination.styles.includes(preferences.style)),
  );
  try {
    const snapshots = await getDailyWeatherBatch(candidates, 16);
    const scored = snapshots
      .map((snapshot) => {
        const days = snapshot.daily.filter(
          (day) => day.date >= body.startDate! && day.date <= body.endDate!,
        );
        const score = calculateTripScore(days, snapshot.risks, preferences);
        return score
          ? {
              location: snapshot.location,
              score,
              days,
              risks: snapshot.risks.filter((risk) =>
                days.some((day) => day.date === risk.date),
              ),
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    scored.sort((left, right) => {
      if (isBetterScore(left.score, right.score)) return -1;
      if (isBetterScore(right.score, left.score)) return 1;
      return left.location.name.localeCompare(right.location.name);
    });
    const response: RecommendationResponse = {
      recommendations: scored.slice(0, 12),
      evaluatedDestinations: scored.length,
      generatedAt: new Date().toISOString(),
    };
    return Response.json(response, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return error(
      "WEATHER_SERVICE_UNAVAILABLE",
      "Destination recommendations are temporarily unavailable.",
      503,
    );
  }
}
