import type {
  ActivityPlan,
  ActivityType,
  DailyForecast,
  HourlyForecast,
  PackingSuggestion,
  PreferenceWeight,
  ScoreReason,
  TravelPreferences,
  TravelStyle,
  WeatherWindow,
} from "../types";

export const EMPTY_ACTIVITY_PLAN: ActivityPlan = {
  defaultActivity: "auto",
  destinationOverrides: {},
  dayOverrides: {},
};

export const ACTIVITY_LABELS: Record<ActivityType | "auto", string> = {
  auto: "Match travel style",
  general: "General exploring",
  beach: "Beach time",
  sightseeing: "Sightseeing",
  hiking: "Hiking",
  winter: "Winter activities",
};

const STYLE_ACTIVITY: Record<TravelStyle, ActivityType> = {
  beach: "beach",
  city: "sightseeing",
  outdoors: "hiking",
  winter: "winter",
  custom: "general",
};

const ACTIVITY_ADJUSTMENTS: Record<
  ActivityType,
  { temperatureMin: number; temperatureMax: number; rain: number; wind: number; uv: number }
> = {
  general: { temperatureMin: -2, temperatureMax: 2, rain: 1, wind: 5, uv: 1 },
  beach: { temperatureMin: 2, temperatureMax: 4, rain: 0, wind: -5, uv: -1 },
  sightseeing: { temperatureMin: -3, temperatureMax: 0, rain: 1, wind: 2, uv: 1 },
  hiking: { temperatureMin: -5, temperatureMax: -2, rain: 0, wind: -8, uv: 0 },
  winter: { temperatureMin: -12, temperatureMax: -10, rain: 2, wind: -5, uv: 2 },
};

const FACTOR_LABELS: Record<ScoreReason["factor"], string> = {
  temperature: "Temperature is outside your comfort range",
  rain: "Rain may interrupt plans",
  wind: "Wind may make activities uncomfortable",
  uv: "UV exposure is above your preference",
  conditions: "Conditions are not ideal for this activity",
  risk: "Travel risks affect this time",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isActivity(value: unknown): value is ActivityType {
  return ["general", "beach", "sightseeing", "hiking", "winter"].includes(
    String(value),
  );
}

export function normalizeActivityPlan(value: unknown): ActivityPlan {
  if (!value || typeof value !== "object") return EMPTY_ACTIVITY_PLAN;
  const item = value as Partial<ActivityPlan>;
  const defaultActivity =
    item.defaultActivity === "auto" || isActivity(item.defaultActivity)
      ? item.defaultActivity
      : "auto";
  const normalizeOverrides = (overrides: unknown) =>
    overrides && typeof overrides === "object"
      ? Object.fromEntries(
          Object.entries(overrides as Record<string, unknown>)
            .filter(([key, activity]) => key.length <= 120 && isActivity(activity))
            .slice(0, 64),
        ) as Record<string, ActivityType>
      : {};
  return {
    defaultActivity,
    destinationOverrides: normalizeOverrides(item.destinationOverrides),
    dayOverrides: normalizeOverrides(item.dayOverrides),
  };
}

export function activityForStyle(style: TravelStyle): ActivityType {
  return STYLE_ACTIVITY[style];
}

export function activityForDate(
  plan: ActivityPlan,
  preferences: TravelPreferences,
  locationId: string,
  date: string,
): ActivityType {
  return (
    plan.dayOverrides[`${locationId}|${date}`] ??
    plan.destinationOverrides[locationId] ??
    (plan.defaultActivity === "auto"
      ? activityForStyle(preferences.style)
      : plan.defaultActivity)
  );
}

function conditionPenalty(code: number, activity: ActivityType) {
  if (code >= 95) return 32;
  if (code >= 71) return activity === "winter" ? 3 : 22;
  if (code >= 51) return 18;
  if (code >= 45) return activity === "sightseeing" ? 8 : 13;
  if (code <= 2) return activity === "winter" ? 3 : 0;
  return 4;
}

function scoreLabel(score: number): WeatherWindow["label"] {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Mixed";
  return "Poor fit";
}

function impactReason(factor: ScoreReason["factor"], impact: number): ScoreReason {
  return { factor, impact: Math.round(impact), label: FACTOR_LABELS[factor] };
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function addHour(localIso: string) {
  const date = new Date(`${localIso}:00Z`);
  date.setUTCHours(date.getUTCHours() + 1);
  return date.toISOString().slice(0, 16);
}

function weight(value: PreferenceWeight) {
  return value / 2;
}

export function calculateWeatherWindows(
  hourly: HourlyForecast[],
  day: DailyForecast,
  preferences: TravelPreferences,
  activity: ActivityType,
): WeatherWindow[] {
  const hours = hourly.filter((hour) => hour.time.startsWith(`${day.date}T`));
  if (hours.length < 3) return [];
  const sunriseHour = Number(day.sunrise.slice(11, 13)) || 6;
  const sunsetHour = Number(day.sunset.slice(11, 13)) || 22;
  const earliest = Math.max(6, sunriseHour);
  const latest = Math.min(22, Math.max(earliest + 3, sunsetHour + 1));
  const adjustment = ACTIVITY_ADJUSTMENTS[activity];
  const temperatureMin = preferences.temperatureMin + adjustment.temperatureMin;
  const temperatureMax = preferences.temperatureMax + adjustment.temperatureMax;
  const rainTolerance = Math.max(0, preferences.precipitationTolerance / 8 + adjustment.rain);
  const windTolerance = Math.max(10, preferences.windGustTolerance + adjustment.wind);
  const uvTolerance = Math.max(0, preferences.uvTolerance + adjustment.uv);
  const candidates: WeatherWindow[] = [];

  for (let index = 0; index <= hours.length - 3; index += 1) {
    const block = hours.slice(index, index + 3);
    const startHour = Number(block[0].time.slice(11, 13));
    if (startHour < earliest || startHour + 3 > latest) continue;
    const apparent = mean(block.map((hour) => hour.apparentTemperature));
    const temperatureDistance =
      apparent < temperatureMin
        ? temperatureMin - apparent
        : apparent > temperatureMax
          ? apparent - temperatureMax
          : 0;
    const precipitationAmount = block.reduce(
      (sum, hour) => sum + hour.precipitation,
      0,
    );
    const precipitationChance = Math.max(
      ...block.map((hour) => hour.precipitationProbability),
    );
    const gust = Math.max(...block.map((hour) => hour.windGusts));
    const uv = Math.max(...block.map((hour) => hour.uvIndex));
    const weatherCode = Math.max(...block.map((hour) => hour.weatherCode));
    const impacts: Array<[ScoreReason["factor"], number]> = [
      [
        "temperature",
        clamp(temperatureDistance * 4, 0, 34) * weight(preferences.weights.temperature),
      ],
      [
        "rain",
        clamp(
          Math.max(0, precipitationAmount - rainTolerance) * 9 +
            Math.max(0, precipitationChance - 35) * 0.22,
          0,
          36,
        ) * weight(preferences.weights.rain),
      ],
      [
        "wind",
        clamp(Math.max(0, gust - windTolerance) * 0.9, 0, 30) *
          weight(preferences.weights.wind),
      ],
      [
        "uv",
        clamp(Math.max(0, uv - uvTolerance) * 4, 0, 24) *
          weight(preferences.weights.uv),
      ],
      [
        "conditions",
        conditionPenalty(weatherCode, activity) * weight(preferences.weights.conditions),
      ],
    ];
    const totalImpact = impacts.reduce((sum, [, impact]) => sum + impact, 0);
    const score = Math.round(clamp(100 - totalImpact, 0, 100));
    const reasons = impacts
      .filter(([, impact]) => impact > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([factor, impact]) => impactReason(factor, impact));
    candidates.push({
      start: block[0].time,
      end: addHour(block[2].time),
      score,
      label: scoreLabel(score),
      reasons: reasons.length
        ? reasons
        : [{ factor: "conditions", impact: 0, label: "Comfortable conditions for your plans" }],
      activity,
      caution: score < 50,
    });
  }

  const selected: WeatherWindow[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const overlaps = selected.some(
      (window) => candidate.start < window.end && candidate.end > window.start,
    );
    if (!overlaps) selected.push(candidate);
    if (selected.length === 3) break;
  }
  return selected;
}

export function packingSuggestions(
  days: DailyForecast[],
  hourly: HourlyForecast[],
): PackingSuggestion[] {
  const suggestions: PackingSuggestion[] = [];
  const add = (id: string, label: string, reason: string) => {
    if (!suggestions.some((item) => item.id === id)) {
      suggestions.push({ id, label, reason });
    }
  };
  if (days.some((day) => day.precipitation >= 5 || day.precipitationProbability >= 60)) {
    add("rain", "Pack rain protection", "Rain is possible during the selected dates.");
  }
  if (days.some((day) => day.uvIndexMax >= 6)) {
    add("sun", "Bring sun protection", "UV levels may be high outdoors.");
  }
  if (days.some((day) => day.apparentTemperatureMax >= 35)) {
    add("heat", "Plan for heat and hydration", "Some periods may feel very hot.");
  }
  if (days.some((day) => day.temperatureMin <= 12)) {
    add("layers", "Bring warm layers", "Mornings or evenings may feel cool.");
  }
  if (days.some((day) => day.temperatureMin <= 0)) {
    add("freezing", "Pack insulated clothing", "Freezing conditions are possible.");
  }
  if (days.some((day) => day.windGustsMax >= 40)) {
    add("wind", "Choose wind-resistant clothing", "Strong gusts may affect outdoor plans.");
  }
  if (hourly.some((hour) => hour.visibility > 0 && hour.visibility < 3000)) {
    add("visibility", "Keep plans flexible", "Low visibility may affect travel timing.");
  }
  add("walking", "Pack comfortable walking shoes", "Useful for changing weather and long days out.");
  if (days.some((day) => day.weatherCode >= 80)) {
    add("backup", "Keep an indoor backup", "Showers or storms may interrupt outdoor plans.");
  }
  return suggestions.slice(0, 8);
}
