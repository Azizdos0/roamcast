"use client";

import { AlertTriangle, Backpack, Check, Clock, Sparkles } from "lucide-react";
import {
  ACTIVITY_LABELS,
  activityForDate,
  calculateWeatherWindows,
  packingSuggestions,
} from "../lib/weather-window";
import type {
  ActivityPlan,
  ActivityType,
  DailyForecast,
  TravelPreferences,
  WeatherSnapshot,
} from "../types";

const ACTIVITIES: ActivityType[] = [
  "general",
  "beach",
  "sightseeing",
  "hiking",
  "winter",
];

function localDay(date: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date(`${date}T12:00:00Z`));
}

function windowTime(value: string) {
  const hour = Number(value.slice(11, 13));
  const minute = value.slice(14, 16);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function updatedOverride(
  source: Record<string, ActivityType>,
  key: string,
  value: string,
) {
  const next = { ...source };
  if (value) next[key] = value as ActivityType;
  else delete next[key];
  return next;
}

export function WeatherWindowsPanel({
  snapshot,
  days,
  preferences,
  activityPlan,
  onActivityPlanChange,
  compact = false,
}: {
  snapshot: WeatherSnapshot;
  days: DailyForecast[];
  preferences: TravelPreferences;
  activityPlan: ActivityPlan;
  onActivityPlanChange?: (plan: ActivityPlan) => void;
  compact?: boolean;
}) {
  const destinationOverride =
    activityPlan.destinationOverrides[snapshot.location.id] ?? "";
  return (
    <section className={`weather-windows ${compact ? "compact" : ""}`}>
      <div className="weather-windows-head">
        <div>
          <span><Clock size={15} /> Best weather windows</span>
          <small>Three-hour activity windows in local time</small>
        </div>
        {onActivityPlanChange && (
          <label>
            <span className="sr-only">Activity for {snapshot.location.name}</span>
            <select
              value={destinationOverride}
              onChange={(event) =>
                onActivityPlanChange({
                  ...activityPlan,
                  destinationOverrides: updatedOverride(
                    activityPlan.destinationOverrides,
                    snapshot.location.id,
                    event.target.value,
                  ),
                })
              }
            >
              <option value="">Automatic</option>
              {ACTIVITIES.map((activity) => (
                <option key={activity} value={activity}>
                  {ACTIVITY_LABELS[activity]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="weather-window-days">
        {days.slice(0, 6).map((day) => {
          const dayKey = `${snapshot.location.id}|${day.date}`;
          const activity = activityForDate(
            activityPlan,
            preferences,
            snapshot.location.id,
            day.date,
          );
          const windows = calculateWeatherWindows(
            snapshot.hourly,
            day,
            preferences,
            activity,
          );
          const best = windows[0];
          return (
            <article key={day.date} className={!best || best.caution ? "caution" : ""}>
              <div className="weather-window-day">
                <div>
                  <strong>{localDay(day.date, snapshot.timezone)}</strong>
                  <span>{ACTIVITY_LABELS[activity]}</span>
                </div>
                {onActivityPlanChange && (
                  <label>
                    <span className="sr-only">Override activity for {day.date}</span>
                    <select
                      value={activityPlan.dayOverrides[dayKey] ?? ""}
                      onChange={(event) =>
                        onActivityPlanChange({
                          ...activityPlan,
                          dayOverrides: updatedOverride(
                            activityPlan.dayOverrides,
                            dayKey,
                            event.target.value,
                          ),
                        })
                      }
                    >
                      <option value="">Use trip activity</option>
                      {ACTIVITIES.map((item) => (
                        <option key={item} value={item}>
                          {ACTIVITY_LABELS[item]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {best ? (
                <details>
                  <summary>
                    {best.caution ? <AlertTriangle size={16} /> : <Check size={16} />}
                    <span>
                      <strong>{windowTime(best.start)}–{windowTime(best.end)}</strong>
                      <small>{best.label} · {best.score}/100</small>
                    </span>
                  </summary>
                  <p>{best.reasons.map((reason) => reason.label).join(". ")}</p>
                  {windows.length > 1 && (
                    <div className="weather-window-alternatives">
                      {windows.slice(1).map((window) => (
                        <span key={window.start}>
                          {windowTime(window.start)}–{windowTime(window.end)} · {window.score}
                        </span>
                      ))}
                    </div>
                  )}
                </details>
              ) : (
                <p className="weather-window-unavailable">
                  Hourly guidance is not available for this date.
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p className="window-guidance">
        <Sparkles size={14} /> Planning guidance, not an official warning or guarantee.
      </p>
    </section>
  );
}

export function PackingList({
  snapshot,
  days,
}: {
  snapshot: WeatherSnapshot;
  days: DailyForecast[];
}) {
  const dayDates = new Set(days.map((day) => day.date));
  const hourly = snapshot.hourly.filter((hour) => dayDates.has(hour.time.slice(0, 10)));
  const suggestions = packingSuggestions(days, hourly);
  if (!suggestions.length) return null;
  return (
    <section className="packing-list">
      <div>
        <Backpack size={18} />
        <div>
          <strong>Weather-ready packing</strong>
          <span>Based on the selected forecast</span>
        </div>
      </div>
      <ul>
        {suggestions.map((item) => (
          <li key={item.id}>
            <Check size={14} />
            <span><strong>{item.label}</strong><small>{item.reason}</small></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
