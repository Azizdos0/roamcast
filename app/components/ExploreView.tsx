"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Compass,
  Droplets,
  Heart,
  Map,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Wind,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DESTINATION_REGIONS } from "../lib/destinations";
import { preferencesFor, TRAVEL_PRESETS } from "../lib/trip-score";
import type {
  DestinationRecommendation,
  DestinationRegion,
  Location,
  RecommendationResponse,
  TravelPreferences,
  TravelStyle,
  UnitSystem,
} from "../types";
import { WeatherMap } from "./WeatherMap";

type ExploreViewProps = {
  hydrated: boolean;
  unit: UnitSystem;
  preferences: TravelPreferences;
  favorites: Location[];
  compare: Location[];
  onPreferencesChange: (preferences: TravelPreferences) => void;
  onSaveDefault: (preferences: TravelPreferences) => void;
  onToggleFavorite: (location: Location) => void;
  onAddCompare: (location: Location) => string | null;
};

const PROFILE_LABELS: Record<TravelStyle, string> = {
  beach: "Beach",
  city: "City",
  outdoors: "Outdoors",
  winter: "Winter",
  custom: "Custom",
};

function dateInput(offset = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
}

function locationHref(place: Location) {
  const slug = place.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const params = new URLSearchParams({
    lat: String(place.latitude),
    lon: String(place.longitude),
    name: place.name,
    country: place.country,
  });
  if (place.region) params.set("region", place.region);
  return `/destination/${slug}?${params.toString()}`;
}

function temperature(value: number, unit: UnitSystem) {
  const result = unit === "imperial" ? (value * 9) / 5 + 32 : value;
  return `${Math.round(result)}°${unit === "imperial" ? "F" : "C"}`;
}

function speed(value: number, unit: UnitSystem) {
  return unit === "imperial"
    ? `${Math.round(value * 0.621371)} mph`
    : `${Math.round(value)} km/h`;
}

function precipitation(value: number, unit: UnitSystem) {
  return unit === "imperial"
    ? `${(value / 25.4).toFixed(2)} in`
    : `${Math.round(value)} mm`;
}

function toDisplayTemperature(value: number, unit: UnitSystem) {
  return Math.round(unit === "imperial" ? (value * 9) / 5 + 32 : value);
}

function fromDisplayTemperature(value: number, unit: UnitSystem) {
  return unit === "imperial" ? ((value - 32) * 5) / 9 : value;
}

export function ExploreView({
  hydrated,
  unit,
  preferences,
  favorites,
  compare,
  onPreferencesChange,
  onSaveDefault,
  onToggleFavorite,
  onAddCompare,
}: ExploreViewProps) {
  const [startDate, setStartDate] = useState(dateInput(0));
  const [endDate, setEndDate] = useState(dateInput(4));
  const [region, setRegion] = useState<DestinationRegion | "all">("all");
  const [recommendations, setRecommendations] = useState<DestinationRecommendation[]>([]);
  const [evaluated, setEvaluated] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeLocationId, setActiveLocationId] = useState("");
  const forecastEnd = dateInput(15);

  const findDestinations = useCallback(async () => {
    if (!hydrated) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, region, preferences }),
      });
      const payload = (await response.json()) as RecommendationResponse & {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message || "Recommendations are unavailable.");
      }
      setRecommendations(payload.recommendations);
      setEvaluated(payload.evaluatedDestinations);
      setActiveLocationId(payload.recommendations[0]?.location.id ?? "");
      if (!payload.recommendations.length) {
        setMessage("No destinations match these filters. Try another region or travel style.");
      }
    } catch (error) {
      setRecommendations([]);
      setMessage(error instanceof Error ? error.message : "Recommendations are unavailable.");
    } finally {
      setLoading(false);
    }
  }, [endDate, hydrated, preferences, region, startDate]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void findDestinations();
    });
    return () => {
      cancelled = true;
    };
    // Run once after stored preferences have hydrated. Further changes use the form button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const mapLocations = useMemo(() => {
    const locations = recommendations.map((item) => item.location);
    return activeLocationId
      ? [...locations].sort((left, right) =>
          left.id === activeLocationId ? -1 : right.id === activeLocationId ? 1 : 0,
        )
      : locations;
  }, [activeLocationId, recommendations]);
  const mapTemperatures = useMemo(
    () =>
      Object.fromEntries(
        recommendations.map((item) => [
          item.location.id,
          item.days[0] ? temperature(item.days[0].temperatureMax, unit) : "Forecast",
        ]),
      ),
    [recommendations, unit],
  );

  const update = (changes: Partial<TravelPreferences>) =>
    onPreferencesChange({ ...preferences, ...changes, style: "custom" });

  return (
    <>
      <section className="explore-hero">
        <div>
          <span className="section-kicker">Weather-first discovery</span>
          <h1>Where should the weather take you?</h1>
          <p>
            Choose your dates and travel style. RoamCast ranks destinations using
            live forecasts and the conditions that matter to you.
          </p>
        </div>
        <Sparkles size={40} strokeWidth={1.4} aria-hidden="true" />
      </section>

      <form
        className="explore-filters panel"
        onSubmit={(event) => {
          event.preventDefault();
          void findDestinations();
        }}
      >
        <div className="explore-filter-row">
          <label>
            <span>From</span>
            <input
              type="date"
              value={startDate}
              min={dateInput(0)}
              max={forecastEnd}
              onChange={(event) => {
                setStartDate(event.target.value);
                if (endDate < event.target.value) setEndDate(event.target.value);
              }}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={forecastEnd}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label>
            <span>Region</span>
            <select
              value={region}
              onChange={(event) =>
                setRegion(event.target.value as DestinationRegion | "all")
              }
            >
              {DESTINATION_REGIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="explore-styles">
          <legend>Travel style</legend>
          {(Object.keys(TRAVEL_PRESETS) as Array<Exclude<TravelStyle, "custom">>).map(
            (style) => (
              <button
                type="button"
                key={style}
                className={preferences.style === style ? "selected" : ""}
                onClick={() => onPreferencesChange(preferencesFor(style))}
              >
                {PROFILE_LABELS[style]}
              </button>
            ),
          )}
        </fieldset>

        <details className="explore-advanced">
          <summary>Fine-tune weather preferences</summary>
          <div className="explore-preference-grid">
            <label>
              <span>Comfortable from ({unit === "imperial" ? "°F" : "°C"})</span>
              <input
                type="number"
                value={toDisplayTemperature(preferences.temperatureMin, unit)}
                onChange={(event) =>
                  update({
                    temperatureMin: fromDisplayTemperature(Number(event.target.value), unit),
                  })
                }
              />
            </label>
            <label>
              <span>Comfortable to ({unit === "imperial" ? "°F" : "°C"})</span>
              <input
                type="number"
                value={toDisplayTemperature(preferences.temperatureMax, unit)}
                onChange={(event) =>
                  update({
                    temperatureMax: fromDisplayTemperature(Number(event.target.value), unit),
                  })
                }
              />
            </label>
            <label>
              <span>Daily rain ({unit === "imperial" ? "in" : "mm"})</span>
              <input
                type="number"
                min="0"
                step={unit === "imperial" ? "0.1" : "1"}
                value={
                  unit === "imperial"
                    ? (preferences.precipitationTolerance / 25.4).toFixed(1)
                    : Math.round(preferences.precipitationTolerance)
                }
                onChange={(event) =>
                  update({
                    precipitationTolerance:
                      Number(event.target.value) * (unit === "imperial" ? 25.4 : 1),
                  })
                }
              />
            </label>
            <label>
              <span>Wind gusts ({unit === "imperial" ? "mph" : "km/h"})</span>
              <input
                type="number"
                min="0"
                value={Math.round(
                  preferences.windGustTolerance * (unit === "imperial" ? 0.621371 : 1),
                )}
                onChange={(event) =>
                  update({
                    windGustTolerance:
                      Number(event.target.value) / (unit === "imperial" ? 0.621371 : 1),
                  })
                }
              />
            </label>
            <label>
              <span>UV tolerance</span>
              <input
                type="number"
                min="0"
                max="11"
                value={preferences.uvTolerance}
                onChange={(event) => update({ uvTolerance: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>Preferred conditions</span>
              <select
                value={preferences.preferredCondition}
                onChange={(event) =>
                  update({
                    preferredCondition: event.target
                      .value as TravelPreferences["preferredCondition"],
                  })
                }
              >
                <option value="sunny">Sunny</option>
                <option value="balanced">Balanced</option>
                <option value="snowy">Snow-friendly</option>
              </select>
            </label>
          </div>
          <div className="explore-weights">
            {(["temperature", "rain", "wind", "uv", "conditions"] as const).map(
              (factor) => (
                <label key={factor}>
                  <span>{factor === "uv" ? "UV" : factor}</span>
                  <select
                    value={preferences.weights[factor]}
                    onChange={(event) =>
                      onPreferencesChange({
                        ...preferences,
                        style: "custom",
                        weights: {
                          ...preferences.weights,
                          [factor]: Number(event.target.value) as 1 | 2 | 3,
                        },
                      })
                    }
                  >
                    <option value="1">Low</option>
                    <option value="2">Standard</option>
                    <option value="3">Priority</option>
                  </select>
                </label>
              ),
            )}
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onSaveDefault(preferences);
              setMessage("Travel preferences saved on this device.");
            }}
          >
            <Check size={17} /> Save as my default
          </button>
        </details>

        <button type="submit" className="primary-button explore-submit" disabled={loading}>
          <Search size={18} /> {loading ? "Finding matches…" : "Find my destinations"}
        </button>
      </form>

      {message && (
        <div className="notice" role="status" aria-live="polite">
          <AlertTriangle size={17} /> <span>{message}</span>
        </div>
      )}

      <section className="explore-results" aria-busy={loading} aria-live="polite">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Personalized matches</span>
            <h2>{loading ? "Reading the forecast…" : "Best places for your dates"}</h2>
          </div>
          {!loading && recommendations.length > 0 && (
            <span className="limit-note">Top {recommendations.length} of {evaluated}</span>
          )}
        </div>
        {loading ? (
          <div className="explore-skeletons" role="status">
            <span /><span /><span />
          </div>
        ) : recommendations.length ? (
          <div className="explore-layout">
            <div className="recommendation-grid">
              {recommendations.map((item, index) => {
                const firstDay = item.days[0];
                const favorite = favorites.some((place) => place.id === item.location.id);
                const compared = compare.some((place) => place.id === item.location.id);
                return (
                  <article
                    className={`recommendation-card tone-${(index % 3) + 1} ${
                      activeLocationId === item.location.id ? "active" : ""
                    }`}
                    key={item.location.id}
                  >
                    <div className="recommendation-rank">#{index + 1}</div>
                    <div className="recommendation-head">
                      <div>
                        <span><MapPin size={14} /> {item.location.country}</span>
                        <h3>{item.location.name}</h3>
                      </div>
                      <div className={`recommendation-score score-${item.score.label.toLowerCase().replace(" ", "-")}`}>
                        <strong>{item.score.value}</strong>
                        <span>{item.score.label}</span>
                      </div>
                    </div>
                    {firstDay && (
                      <div className="recommendation-weather">
                        <strong>{temperature(firstDay.temperatureMax, unit)}</strong>
                        <span>Low {temperature(firstDay.temperatureMin, unit)}</span>
                        <span><Droplets size={14} /> {precipitation(firstDay.precipitation, unit)}</span>
                        <span><Wind size={14} /> {speed(firstDay.windGustsMax, unit)}</span>
                      </div>
                    )}
                    <p className="recommendation-reasons">
                      {item.score.reasons.map((reason) => reason.label).join(". ")}
                    </p>
                    {item.risks.length ? (
                      <p className="recommendation-risk"><AlertTriangle size={15} /> {item.risks[0].title}</p>
                    ) : (
                      <p className="recommendation-clear"><Check size={15} /> Clear travel outlook</p>
                    )}
                    <div className="recommendation-actions">
                      <Link href={locationHref(item.location)}>
                        Forecast <ArrowRight size={15} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          const nextMessage = onAddCompare(item.location);
                          setMessage(nextMessage ?? `${item.location.name} added to Compare.`);
                        }}
                        disabled={compared}
                      >
                        <Plus size={15} /> {compared ? "Added" : "Compare"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(item.location)}
                        aria-label={`${favorite ? "Remove" : "Save"} ${item.location.name}`}
                      >
                        <Heart size={15} fill={favorite ? "currentColor" : "none"} />
                        {favorite ? "Saved" : "Save"}
                      </button>
                      <button type="button" onClick={() => setActiveLocationId(item.location.id)}>
                        <Map size={15} /> Map
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <aside className="explore-map-panel panel" aria-label="Recommendation map">
              <div>
                <Compass size={19} />
                <strong>Explore the matches</strong>
              </div>
              <WeatherMap locations={mapLocations} temperatures={mapTemperatures} />
            </aside>
          </div>
        ) : (
          <div className="empty-panel">
            <Compass size={26} aria-hidden="true" />
            <h3>No recommendations yet</h3>
            <p>Adjust your dates, region, or travel style and search again.</p>
          </div>
        )}
      </section>

      <p className="planning-disclaimer">
        Trip Scores are planning guidance based on live forecast data, not an official
        warning or a guarantee of conditions.
      </p>
    </>
  );
}
