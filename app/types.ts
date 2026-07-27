export type UnitSystem = "metric" | "imperial";

export type Location = {
  id: string;
  name: string;
  country: string;
  region?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export type CurrentConditions = {
  observedAt: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  weatherCode: number;
  cloudCover: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  isDay: boolean;
};

export type HourlyForecast = {
  time: string;
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  precipitation: number;
  weatherCode: number;
  cloudCover: number;
  visibility: number;
  windSpeed: number;
  windGusts: number;
};

export type DailyForecast = {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  apparentTemperatureMax: number;
  apparentTemperatureMin: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
  precipitation: number;
  precipitationProbability: number;
  windSpeedMax: number;
  windGustsMax: number;
};

export type TravelRisk = {
  id: string;
  level: "watch" | "caution";
  title: string;
  detail: string;
  date: string;
};

export type WeatherSnapshot = {
  location: Location;
  timezone: string;
  timezoneAbbreviation: string;
  utcOffsetSeconds: number;
  elevation: number;
  current: CurrentConditions;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  risks: TravelRisk[];
  fetchedAt: string;
  stale?: boolean;
};

export type SavedPlace = Location & {
  savedAt: string;
};

export type TravelStyle = "beach" | "city" | "outdoors" | "winter" | "custom";

export type PreferenceWeight = 1 | 2 | 3;

export type TravelPreferences = {
  style: TravelStyle;
  temperatureMin: number;
  temperatureMax: number;
  precipitationTolerance: number;
  windGustTolerance: number;
  uvTolerance: number;
  preferredCondition: "sunny" | "balanced" | "snowy";
  weights: {
    temperature: PreferenceWeight;
    rain: PreferenceWeight;
    wind: PreferenceWeight;
    uv: PreferenceWeight;
    conditions: PreferenceWeight;
  };
};

export type ScoreReason = {
  factor: "temperature" | "rain" | "wind" | "uv" | "conditions" | "risk";
  label: string;
  impact: number;
};

export type TripScore = {
  value: number;
  label: "Excellent" | "Good" | "Mixed" | "Poor fit";
  reasons: ScoreReason[];
  cautionCount: number;
  totalPrecipitation: number;
};

export type TripPlan = {
  id: string;
  name: string;
  locations: Location[];
  startDate: string;
  endDate: string;
  createdAt: string;
  preferences: TravelPreferences;
};

export type StoredState = {
  version: 2;
  unit: UnitSystem;
  favorites: SavedPlace[];
  recent: Location[];
  compare: Location[];
  trips: TripPlan[];
  travelPreferences: TravelPreferences;
  lastLocation?: Location;
  lastForecast?: WeatherSnapshot;
};
