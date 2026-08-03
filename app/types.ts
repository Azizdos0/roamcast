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
  uvIndex: number;
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

export type DestinationRegion =
  | "europe"
  | "asia"
  | "middle-east-africa"
  | "north-america"
  | "latin-america-caribbean"
  | "oceania";

export type ActivityType =
  | "general"
  | "beach"
  | "sightseeing"
  | "hiking"
  | "winter";

export type ActivityPlan = {
  defaultActivity: ActivityType | "auto";
  destinationOverrides: Record<string, ActivityType>;
  dayOverrides: Record<string, ActivityType>;
};

export type WeatherWindow = {
  start: string;
  end: string;
  score: number;
  label: TripScore["label"];
  reasons: ScoreReason[];
  activity: ActivityType;
  caution: boolean;
};

export type PackingSuggestion = {
  id: string;
  label: string;
  reason: string;
};

export type DestinationCatalogEntry = Location & {
  catalogRegion: DestinationRegion;
  styles: Array<Exclude<TravelStyle, "custom">>;
};

export type DestinationRecommendation = {
  location: Location;
  score: TripScore;
  days: DailyForecast[];
  risks: TravelRisk[];
};

export type RecommendationRequest = {
  startDate: string;
  endDate: string;
  region: DestinationRegion | "all";
  preferences: TravelPreferences;
};

export type RecommendationResponse = {
  recommendations: DestinationRecommendation[];
  evaluatedDestinations: number;
  generatedAt: string;
};

export type TripPlan = {
  id: string;
  name: string;
  locations: Location[];
  startDate: string;
  endDate: string;
  createdAt: string;
  preferences: TravelPreferences;
  activityPlan: ActivityPlan;
};

export type StoredState = {
  version: 3;
  unit: UnitSystem;
  favorites: SavedPlace[];
  recent: Location[];
  compare: Location[];
  trips: TripPlan[];
  travelPreferences: TravelPreferences;
  lastLocation?: Location;
  lastForecast?: WeatherSnapshot;
};

export type SharedTripPayloadV1 = {
  version: 1;
  name?: string;
  locations: Location[];
  startDate: string;
  endDate: string;
  preferences: TravelPreferences;
  activityPlan: ActivityPlan;
};
