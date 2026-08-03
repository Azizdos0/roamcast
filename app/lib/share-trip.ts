import { normalizeTravelPreferences } from "./trip-score";
import { normalizeActivityPlan } from "./weather-window";
import type { Location, SharedTripPayloadV1 } from "../types";

export const MAX_SHARE_CODE_LENGTH = 4096;

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizedLocation(value: unknown): Location | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<Location>;
  if (
    typeof item.name !== "string" ||
    item.name.length < 1 ||
    item.name.length > 80 ||
    typeof item.country !== "string" ||
    item.country.length > 80 ||
    typeof item.latitude !== "number" ||
    !Number.isFinite(item.latitude) ||
    item.latitude < -90 ||
    item.latitude > 90 ||
    typeof item.longitude !== "number" ||
    !Number.isFinite(item.longitude) ||
    item.longitude < -180 ||
    item.longitude > 180
  ) {
    return null;
  }
  return {
    id: `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`,
    name: item.name,
    country: item.country,
    region:
      typeof item.region === "string" && item.region.length <= 80
        ? item.region
        : undefined,
    latitude: item.latitude,
    longitude: item.longitude,
    timezone:
      typeof item.timezone === "string" && item.timezone.length <= 80
        ? item.timezone
        : undefined,
  };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64ToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeSharedTrip(payload: SharedTripPayloadV1) {
  const code = bytesToBase64(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  if (code.length > MAX_SHARE_CODE_LENGTH) {
    throw new Error("SHARE_CODE_TOO_LONG");
  }
  return code;
}

export function decodeSharedTrip(code: string): SharedTripPayloadV1 | null {
  if (
    !code ||
    code.length > MAX_SHARE_CODE_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(code)
  ) {
    return null;
  }
  try {
    const raw = JSON.parse(
      new TextDecoder().decode(base64ToBytes(code)),
    ) as Partial<SharedTripPayloadV1>;
    if (
      raw.version !== 1 ||
      !Array.isArray(raw.locations) ||
      raw.locations.length < 1 ||
      raw.locations.length > 3 ||
      !isIsoDate(raw.startDate) ||
      !isIsoDate(raw.endDate) ||
      raw.startDate > raw.endDate
    ) {
      return null;
    }
    const locations = raw.locations.map(normalizedLocation);
    if (locations.some((location) => !location)) return null;
    return {
      version: 1,
      name:
        typeof raw.name === "string" && raw.name.length <= 160
          ? raw.name
          : undefined,
      locations: locations as Location[],
      startDate: raw.startDate,
      endDate: raw.endDate,
      preferences: normalizeTravelPreferences(raw.preferences),
      activityPlan: normalizeActivityPlan(raw.activityPlan),
    };
  } catch {
    return null;
  }
}
