import type {
  DailyForecast,
  PreferenceWeight,
  ScoreReason,
  TravelPreferences,
  TravelStyle,
  TripScore,
  TravelRisk,
} from "../types";

type Preset = Omit<TravelPreferences, "style">;

export const TRAVEL_PRESETS: Record<Exclude<TravelStyle, "custom">, Preset> = {
  beach: {
    temperatureMin: 23,
    temperatureMax: 32,
    precipitationTolerance: 4,
    windGustTolerance: 35,
    uvTolerance: 8,
    preferredCondition: "sunny",
    weights: { temperature: 3, rain: 3, wind: 2, uv: 1, conditions: 3 },
  },
  city: {
    temperatureMin: 15,
    temperatureMax: 27,
    precipitationTolerance: 10,
    windGustTolerance: 45,
    uvTolerance: 8,
    preferredCondition: "balanced",
    weights: { temperature: 3, rain: 2, wind: 2, uv: 1, conditions: 2 },
  },
  outdoors: {
    temperatureMin: 10,
    temperatureMax: 24,
    precipitationTolerance: 5,
    windGustTolerance: 30,
    uvTolerance: 7,
    preferredCondition: "sunny",
    weights: { temperature: 3, rain: 3, wind: 3, uv: 2, conditions: 2 },
  },
  winter: {
    temperatureMin: -8,
    temperatureMax: 8,
    precipitationTolerance: 10,
    windGustTolerance: 45,
    uvTolerance: 6,
    preferredCondition: "snowy",
    weights: { temperature: 3, rain: 2, wind: 2, uv: 1, conditions: 3 },
  },
};

export const DEFAULT_TRAVEL_PREFERENCES: TravelPreferences = {
  style: "city",
  ...TRAVEL_PRESETS.city,
};

const FACTORS = ["temperature", "rain", "wind", "uv", "conditions"] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function weight(value: unknown): PreferenceWeight {
  return value === 1 || value === 3 ? value : 2;
}

export function preferencesFor(style: Exclude<TravelStyle, "custom">): TravelPreferences {
  return { style, ...TRAVEL_PRESETS[style], weights: { ...TRAVEL_PRESETS[style].weights } };
}

export function normalizeTravelPreferences(value: unknown): TravelPreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_TRAVEL_PREFERENCES, weights: { ...DEFAULT_TRAVEL_PREFERENCES.weights } };
  const input = value as Partial<TravelPreferences>;
  const base = input.style && input.style !== "custom" && input.style in TRAVEL_PRESETS
    ? preferencesFor(input.style)
    : { ...DEFAULT_TRAVEL_PREFERENCES, weights: { ...DEFAULT_TRAVEL_PREFERENCES.weights } };
  const min = clamp(finite(input.temperatureMin, base.temperatureMin), -30, 45);
  const max = clamp(finite(input.temperatureMax, base.temperatureMax), min + 1, 50);
  const inputWeights: Partial<TravelPreferences["weights"]> = input.weights ?? {};
  return {
    style: input.style === "beach" || input.style === "city" || input.style === "outdoors" || input.style === "winter" || input.style === "custom" ? input.style : base.style,
    temperatureMin: min,
    temperatureMax: max,
    precipitationTolerance: clamp(finite(input.precipitationTolerance, base.precipitationTolerance), 0, 50),
    windGustTolerance: clamp(finite(input.windGustTolerance, base.windGustTolerance), 10, 120),
    uvTolerance: clamp(finite(input.uvTolerance, base.uvTolerance), 0, 11),
    preferredCondition: input.preferredCondition === "sunny" || input.preferredCondition === "snowy" ? input.preferredCondition : "balanced",
    weights: {
      temperature: weight(inputWeights.temperature),
      rain: weight(inputWeights.rain),
      wind: weight(inputWeights.wind),
      uv: weight(inputWeights.uv),
      conditions: weight(inputWeights.conditions),
    },
  };
}

function conditionPenalty(code: number, preference: TravelPreferences["preferredCondition"]) {
  const type = code >= 95 ? "storm" : code >= 71 && code <= 86 ? "snow" : code >= 51 && code <= 82 ? "rain" : code >= 45 ? "cloud" : "clear";
  if (preference === "sunny") return type === "clear" ? 0 : type === "cloud" ? 6 : type === "snow" ? 13 : type === "rain" ? 20 : 28;
  if (preference === "snowy") return type === "snow" ? 0 : type === "clear" ? 4 : type === "cloud" ? 8 : type === "rain" ? 17 : 28;
  return type === "storm" ? 28 : type === "rain" ? 13 : type === "snow" ? 8 : type === "cloud" ? 3 : 0;
}

function labelFor(score: number): TripScore["label"] {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Mixed";
  return "Poor fit";
}

function reasonLabel(factor: ScoreReason["factor"], impact: number) {
  const rounded = Math.round(impact);
  const points = `${rounded} ${rounded === 1 ? "point" : "points"}`;
  if (factor === "temperature") return `Temperature is ${points} outside your comfort range`;
  if (factor === "rain") return `Rain is costing ${points}`;
  if (factor === "wind") return `Wind is costing ${points}`;
  if (factor === "uv") return `UV is costing ${points}`;
  if (factor === "conditions") return `Forecast conditions are costing ${points}`;
  return `Travel risks are costing ${points}`;
}

export function calculateTripScore(
  days: DailyForecast[],
  risks: TravelRisk[],
  preferences: TravelPreferences,
): TripScore | null {
  if (!days.length) return null;
  const totals: Record<ScoreReason["factor"], number> = {
    temperature: 0, rain: 0, wind: 0, uv: 0, conditions: 0, risk: 0,
  };
  for (const day of days) {
    const apparent = (day.apparentTemperatureMin + day.apparentTemperatureMax) / 2;
    const temperatureDistance = apparent < preferences.temperatureMin
      ? preferences.temperatureMin - apparent
      : apparent > preferences.temperatureMax
        ? apparent - preferences.temperatureMax
        : 0;
    totals.temperature += clamp(temperatureDistance * 3, 0, 32) * (preferences.weights.temperature / 2);
    totals.rain += clamp(
      ((Math.max(0, day.precipitation - preferences.precipitationTolerance) / Math.max(4, preferences.precipitationTolerance + 2)) * 25) +
      (day.precipitationProbability > 75 ? 4 : 0),
      0,
      32,
    ) * (preferences.weights.rain / 2);
    totals.wind += clamp(
      Math.max(0, day.windGustsMax - preferences.windGustTolerance) * 0.8,
      0,
      28,
    ) * (preferences.weights.wind / 2);
    totals.uv += clamp(Math.max(0, day.uvIndexMax - preferences.uvTolerance) * 4, 0, 24) * (preferences.weights.uv / 2);
    totals.conditions += conditionPenalty(day.weatherCode, preferences.preferredCondition) * (preferences.weights.conditions / 2);
  }
  for (const risk of risks.filter((item) => days.some((day) => day.date === item.date))) {
    totals.risk += risk.level === "caution" ? 15 : 8;
  }
  totals.risk = clamp(totals.risk, 0, 28);
  const dayPenalty = FACTORS.reduce((sum, factor) => sum + totals[factor], 0) / days.length;
  const score = Math.round(clamp(100 - dayPenalty - totals.risk, 0, 100));
  const reasons = (Object.entries(totals) as Array<[ScoreReason["factor"], number]>)
    .filter(([, impact]) => impact > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([factor, impact]) => {
      const normalizedImpact = Math.max(1, impact / (factor === "risk" ? 1 : days.length));
      return {
        factor,
        impact: Math.round(normalizedImpact),
        label: reasonLabel(factor, normalizedImpact),
      };
    });
  return {
    value: score,
    label: labelFor(score),
    reasons: reasons.length ? reasons : [{ factor: "conditions", impact: 0, label: "Fits your selected travel preferences" }],
    cautionCount: risks.filter((item) => item.level === "caution" && days.some((day) => day.date === item.date)).length,
    totalPrecipitation: days.reduce((sum, day) => sum + day.precipitation, 0),
  };
}

export function isBetterScore(candidate: TripScore, current: TripScore) {
  if (candidate.value !== current.value) return candidate.value > current.value;
  if (candidate.cautionCount !== current.cautionCount) return candidate.cautionCount < current.cautionCount;
  return candidate.totalPrecipitation < current.totalPrecipitation;
}
