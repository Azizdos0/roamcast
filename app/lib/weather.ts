import type {
  DailyForecast,
  HourlyForecast,
  Location,
  TravelRisk,
  WeatherSnapshot,
} from "../types";

const FORECAST_URL =
  process.env.WEATHER_API_BASE_URL ??
  "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL =
  process.env.GEOCODING_API_BASE_URL ??
  "https://geocoding-api.open-meteo.com/v1/search";
const API_KEY = process.env.WEATHER_API_KEY;
const CACHE_TTL = 10 * 60 * 1000;

type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();
const pending = new Map<string, Promise<unknown>>();

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

async function deduped<T>(key: string, work: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) return cached;
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const request = work()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function item<T>(values: unknown, index: number, fallback: T): T {
  return Array.isArray(values) && values[index] !== undefined
    ? (values[index] as T)
    : fallback;
}

export function locationId(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

export function deriveTravelRisks(days: DailyForecast[]): TravelRisk[] {
  const risks: TravelRisk[] = [];
  for (const day of days) {
    if (day.apparentTemperatureMax >= 40) {
      risks.push({
        id: `heat-${day.date}`,
        level: "caution",
        title: "Extreme heat",
        detail: `Feels like ${Math.round(day.apparentTemperatureMax)}°C. Plan indoor breaks and carry water.`,
        date: day.date,
      });
    }
    if (day.windGustsMax >= 50) {
      risks.push({
        id: `wind-${day.date}`,
        level: "watch",
        title: "Strong wind",
        detail: `Gusts may reach ${Math.round(day.windGustsMax)} km/h. Check outdoor and ferry plans.`,
        date: day.date,
      });
    }
    if (day.precipitation >= 25) {
      risks.push({
        id: `rain-${day.date}`,
        level: "watch",
        title: "Heavy rain",
        detail: `${Math.round(day.precipitation)} mm is forecast. Allow extra travel time.`,
        date: day.date,
      });
    }
    if (day.temperatureMin <= 0) {
      risks.push({
        id: `freeze-${day.date}`,
        level: "watch",
        title: "Freezing conditions",
        detail: `Temperatures may fall to ${Math.round(day.temperatureMin)}°C. Watch for icy surfaces.`,
        date: day.date,
      });
    }
    if (day.weatherCode >= 95) {
      risks.push({
        id: `storm-${day.date}`,
        level: "caution",
        title: "Thunderstorms possible",
        detail: "Keep flexible plans and move indoors if thunder is nearby.",
        date: day.date,
      });
    }
  }
  return risks.slice(0, 5);
}

export async function searchLocations(
  query: string,
  language = "en",
): Promise<Location[]> {
  const key = `locations:${language}:${query.toLowerCase()}`;
  return deduped(key, async () => {
    const url = new URL(GEOCODING_URL);
    url.searchParams.set("name", query);
    url.searchParams.set("count", "8");
    url.searchParams.set("language", language);
    url.searchParams.set("format", "json");
    if (API_KEY) url.searchParams.set("apikey", API_KEY);

    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`LOCATION_PROVIDER_${response.status}`);
    const payload = (await response.json()) as {
      results?: Array<Record<string, unknown>>;
    };
    return (payload.results ?? []).map((result) => {
      const latitude = finite(result.latitude);
      const longitude = finite(result.longitude);
      return {
        id: locationId(latitude, longitude),
        name: String(result.name ?? "Unknown place"),
        country: String(result.country ?? result.country_code ?? ""),
        region:
          typeof result.admin1 === "string" ? result.admin1 : undefined,
        latitude,
        longitude,
        timezone:
          typeof result.timezone === "string" ? result.timezone : undefined,
      };
    });
  });
}

export async function getWeather(
  location: Location,
  forecastDays = 10,
): Promise<WeatherSnapshot> {
  const days = Math.max(1, Math.min(16, forecastDays));
  const key = `weather:${location.id}:${days}`;
  return deduped(key, async () => {
    const url = new URL(FORECAST_URL);
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", String(days));
    url.searchParams.set(
      "current",
      [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "weather_code",
        "cloud_cover",
        "pressure_msl",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
      ].join(","),
    );
    url.searchParams.set(
      "hourly",
      [
        "temperature_2m",
        "apparent_temperature",
        "precipitation_probability",
        "precipitation",
        "weather_code",
        "cloud_cover",
        "visibility",
        "wind_speed_10m",
        "wind_gusts_10m",
      ].join(","),
    );
    url.searchParams.set(
      "daily",
      [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "apparent_temperature_max",
        "apparent_temperature_min",
        "sunrise",
        "sunset",
        "uv_index_max",
        "precipitation_sum",
        "precipitation_probability_max",
        "wind_speed_10m_max",
        "wind_gusts_10m_max",
      ].join(","),
    );
    if (API_KEY) url.searchParams.set("apikey", API_KEY);

    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`WEATHER_PROVIDER_${response.status}`);
    const raw = (await response.json()) as {
      timezone?: unknown;
      timezone_abbreviation?: unknown;
      utc_offset_seconds?: unknown;
      elevation?: unknown;
      current?: Record<string, unknown>;
      hourly?: Record<string, unknown>;
      daily?: Record<string, unknown>;
    };
    const current = raw.current ?? {};
    const hourlyRaw = raw.hourly ?? {};
    const dailyRaw = raw.daily ?? {};

    const hourly: HourlyForecast[] = (
      Array.isArray(hourlyRaw.time) ? hourlyRaw.time : []
    ).map((time: string, index: number) => ({
      time,
      temperature: finite(item(hourlyRaw.temperature_2m, index, 0)),
      apparentTemperature: finite(
        item(hourlyRaw.apparent_temperature, index, 0),
      ),
      precipitationProbability: finite(
        item(hourlyRaw.precipitation_probability, index, 0),
      ),
      precipitation: finite(item(hourlyRaw.precipitation, index, 0)),
      weatherCode: finite(item(hourlyRaw.weather_code, index, 0)),
      cloudCover: finite(item(hourlyRaw.cloud_cover, index, 0)),
      visibility: finite(item(hourlyRaw.visibility, index, 0)),
      windSpeed: finite(item(hourlyRaw.wind_speed_10m, index, 0)),
      windGusts: finite(item(hourlyRaw.wind_gusts_10m, index, 0)),
    }));

    const daily: DailyForecast[] = (
      Array.isArray(dailyRaw.time) ? dailyRaw.time : []
    ).map((date: string, index: number) => ({
      date,
      weatherCode: finite(item(dailyRaw.weather_code, index, 0)),
      temperatureMax: finite(item(dailyRaw.temperature_2m_max, index, 0)),
      temperatureMin: finite(item(dailyRaw.temperature_2m_min, index, 0)),
      apparentTemperatureMax: finite(
        item(dailyRaw.apparent_temperature_max, index, 0),
      ),
      apparentTemperatureMin: finite(
        item(dailyRaw.apparent_temperature_min, index, 0),
      ),
      sunrise: String(item(dailyRaw.sunrise, index, "")),
      sunset: String(item(dailyRaw.sunset, index, "")),
      uvIndexMax: finite(item(dailyRaw.uv_index_max, index, 0)),
      precipitation: finite(item(dailyRaw.precipitation_sum, index, 0)),
      precipitationProbability: finite(
        item(dailyRaw.precipitation_probability_max, index, 0),
      ),
      windSpeedMax: finite(item(dailyRaw.wind_speed_10m_max, index, 0)),
      windGustsMax: finite(item(dailyRaw.wind_gusts_10m_max, index, 0)),
    }));

    return {
      location,
      timezone: String(raw.timezone ?? location.timezone ?? "UTC"),
      timezoneAbbreviation: String(raw.timezone_abbreviation ?? "UTC"),
      utcOffsetSeconds: finite(raw.utc_offset_seconds),
      elevation: finite(raw.elevation),
      current: {
        observedAt: String(current.time ?? new Date().toISOString()),
        temperature: finite(current.temperature_2m),
        apparentTemperature: finite(current.apparent_temperature),
        humidity: finite(current.relative_humidity_2m),
        precipitation: finite(current.precipitation),
        weatherCode: finite(current.weather_code),
        cloudCover: finite(current.cloud_cover),
        pressure: finite(current.pressure_msl),
        windSpeed: finite(current.wind_speed_10m),
        windDirection: finite(current.wind_direction_10m),
        windGusts: finite(current.wind_gusts_10m),
        isDay: Boolean(current.is_day),
      },
      hourly,
      daily,
      risks: deriveTravelRisks(daily),
      fetchedAt: new Date().toISOString(),
    };
  });
}
