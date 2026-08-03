import { DEFAULT_TRAVEL_PREFERENCES, normalizeTravelPreferences } from "./trip-score";
import { EMPTY_ACTIVITY_PLAN, normalizeActivityPlan } from "./weather-window";
import type { StoredState, TripPlan } from "../types";

export const STORAGE_KEY = "roamcast:v3";
const LEGACY_STORAGE_KEYS = ["roamcast:v2", "roamcast:v1"];

export const EMPTY_STORED_STATE: StoredState = {
  version: 3,
  unit: "metric",
  favorites: [],
  recent: [],
  compare: [],
  trips: [],
  travelPreferences: DEFAULT_TRAVEL_PREFERENCES,
};

export function normalizeStoredState(value: unknown): StoredState {
  if (!value || typeof value !== "object") return EMPTY_STORED_STATE;
  const parsed = value as Partial<StoredState> & { trips?: unknown };
  const travelPreferences = normalizeTravelPreferences(parsed.travelPreferences);
  const trips = Array.isArray(parsed.trips)
    ? parsed.trips
        .filter((trip) => trip && typeof trip === "object")
        .map((trip) => ({
          ...(trip as TripPlan),
          preferences: normalizeTravelPreferences(
            (trip as Partial<TripPlan>).preferences ?? travelPreferences,
          ),
          activityPlan: normalizeActivityPlan(
            (trip as Partial<TripPlan>).activityPlan ?? EMPTY_ACTIVITY_PLAN,
          ),
        }))
        .slice(0, 12)
    : [];
  return {
    ...EMPTY_STORED_STATE,
    ...parsed,
    version: 3,
    favorites: Array.isArray(parsed.favorites) ? parsed.favorites.slice(0, 8) : [],
    recent: Array.isArray(parsed.recent) ? parsed.recent.slice(0, 6) : [],
    compare: Array.isArray(parsed.compare) ? parsed.compare.slice(0, 3) : [],
    trips,
    travelPreferences,
  };
}

export function readStoredState(): StoredState {
  if (typeof window === "undefined") return EMPTY_STORED_STATE;
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeStoredState(JSON.parse(current));
    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const migrated = normalizeStoredState(JSON.parse(legacy));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    return EMPTY_STORED_STATE;
  }
  return EMPTY_STORED_STATE;
}

export function writeStoredState(state: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeStoredState(state)));
}

export function saveTripToStorage(trip: TripPlan) {
  const state = readStoredState();
  const trips = [
    trip,
    ...state.trips.filter((existing) => existing.id !== trip.id),
  ].slice(0, 12);
  writeStoredState({ ...state, trips });
}
