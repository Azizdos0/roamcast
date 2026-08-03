"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CloudSun,
  Compass,
  Heart,
  MapPin,
  Navigation,
  Share2,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { calculateTripScore, isBetterScore } from "../lib/trip-score";
import { readStoredState, saveTripToStorage, writeStoredState } from "../lib/storage";
import type {
  SharedTripPayloadV1,
  TripScore,
  UnitSystem,
  WeatherSnapshot,
} from "../types";
import { PackingList, WeatherWindowsPanel } from "./WeatherWindowsPanel";

function temperature(value: number, unit: UnitSystem) {
  const converted = unit === "imperial" ? (value * 9) / 5 + 32 : value;
  return `${Math.round(converted)}°${unit === "imperial" ? "F" : "C"}`;
}

function localDay(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function SharedTripView({
  payload,
}: {
  payload: SharedTripPayloadV1 | null;
}) {
  const [snapshots, setSnapshots] = useState<WeatherSnapshot[]>([]);
  const [loading, setLoading] = useState(Boolean(payload));
  const [message, setMessage] = useState("");
  const [unit, setUnit] = useState<UnitSystem>("metric");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setUnit(readStoredState().unit);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!payload) return;
    const controller = new AbortController();
    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations: payload.locations }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Live weather is temporarily unavailable.");
        return (await response.json()) as { snapshots: WeatherSnapshot[] };
      })
      .then((result) => setSnapshots(result.snapshots))
      .catch((error) => {
        if (error.name !== "AbortError") setMessage(error.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [payload]);

  const comparisons = useMemo(() => {
    if (!payload) return [];
    return snapshots.map((snapshot) => {
      const days = snapshot.daily.filter(
        (day) => day.date >= payload.startDate && day.date <= payload.endDate,
      );
      return {
        snapshot,
        days,
        score: calculateTripScore(days, snapshot.risks, payload.preferences),
      };
    });
  }, [payload, snapshots]);
  const best = comparisons.reduce<
    { snapshot: WeatherSnapshot; score: TripScore } | null
  >((current, item) => {
    if (!item.score) return current;
    return !current || isBetterScore(item.score, current.score)
      ? { snapshot: item.snapshot, score: item.score }
      : current;
  }, null);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: payload?.name || "RoamCast trip brief",
          text: "Compare this travel-weather plan on RoamCast.",
          url: window.location.href,
        });
        setMessage("Trip shared.");
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setMessage("Share link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("The link could not be shared. Copy it from the address bar.");
    }
  };

  if (!payload) {
    return (
      <div className="app-shell shared-shell">
        <header className="site-header">
          <Link href="/" className="brand"><span className="brand-mark"><Navigation size={19} /></span>RoamCast</Link>
        </header>
        <main>
          <section className="invalid-share panel">
            <AlertTriangle size={32} />
            <h1>This trip link is not valid</h1>
            <p>It may be incomplete or from an unsupported version.</p>
            <div><Link href="/explore" className="primary-button">Explore destinations</Link><Link href="/" className="secondary-button">Return home</Link></div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell shared-shell">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <header className="site-header">
        <Link href="/" className="brand" aria-label="RoamCast home">
          <span className="brand-mark"><Navigation size={19} /></span>
          <span>RoamCast</span>
        </Link>
        <nav className="main-nav">
          <Link href="/explore">Explore</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/saved">Saved</Link>
        </nav>
        <button
          type="button"
          className="unit-toggle"
          aria-label={`Switch to ${unit === "metric" ? "Fahrenheit" : "Celsius"}`}
          onClick={() => {
            const next = unit === "metric" ? "imperial" : "metric";
            setUnit(next);
            const stored = readStoredState();
            writeStoredState({ ...stored, unit: next });
          }}
        >
          <span className={unit === "metric" ? "selected" : ""}>°C</span>
          <span className={unit === "imperial" ? "selected" : ""}>°F</span>
        </button>
      </header>
      <main>
        <section className="shared-trip-hero">
          <div>
            <span className="section-kicker">Shared RoamCast trip brief</span>
            <h1>{payload.name || payload.locations.map((place) => place.name).join(" · ")}</h1>
            <p><CalendarDays size={16} /> {localDay(payload.startDate)} – {localDay(payload.endDate)}</p>
            <div className="shared-locations">
              {payload.locations.map((place) => <span key={place.id}><MapPin size={14} /> {place.name}</span>)}
            </div>
          </div>
          <div className="shared-actions">
            <button type="button" className="primary-button" onClick={() => void share()}><Share2 size={17} /> Share trip</button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                saveTripToStorage({
                  id: `shared-${Date.now()}`,
                  name: payload.name || payload.locations.map((place) => place.name).join(" · "),
                  locations: payload.locations,
                  startDate: payload.startDate,
                  endDate: payload.endDate,
                  createdAt: new Date().toISOString(),
                  preferences: payload.preferences,
                  activityPlan: payload.activityPlan,
                });
                setMessage("Trip saved on this device.");
              }}
            ><Heart size={17} /> Save this trip</button>
          </div>
        </section>

        {message && <div className="notice" role="status" aria-live="polite"><Check size={16} /><span>{message}</span></div>}

        {loading ? (
          <div className="forecast-loading" role="status"><span /><p>Building the live trip brief…</p></div>
        ) : comparisons.length ? (
          <section className="shared-comparisons">
            {comparisons.map(({ snapshot, days, score }) => (
              <article className={`shared-destination panel ${best?.snapshot.location.id === snapshot.location.id ? "best-match" : ""}`} key={snapshot.location.id}>
                {best?.snapshot.location.id === snapshot.location.id && <span className="best-match-badge"><Sparkles size={13} /> Best match</span>}
                <div className="shared-destination-head">
                  <div><span>{snapshot.location.country}</span><h2>{snapshot.location.name}</h2></div>
                  {score ? <div className="shared-score"><strong>{score.value}</strong><span>{score.label}</span></div> : <span className="score-unavailable">Trip Score unavailable</span>}
                </div>
                {days[0] && <p className="shared-weather"><CloudSun size={18} /> {temperature(days[0].temperatureMax, unit)} high · {temperature(days[0].temperatureMin, unit)} low</p>}
                {score && <p className="shared-reasons">{score.reasons.map((reason) => reason.label).join(". ")}</p>}
                {days.length ? (
                  <>
                    <WeatherWindowsPanel snapshot={snapshot} days={days} preferences={payload.preferences} activityPlan={payload.activityPlan} />
                    <PackingList snapshot={snapshot} days={days} />
                  </>
                ) : (
                  <div className="range-notice"><CalendarDays size={18} /><div><strong>Live forecast not available yet</strong><p>Check this link again when the dates enter the 16-day window.</p></div></div>
                )}
              </article>
            ))}
          </section>
        ) : (
          <section className="empty-panel"><Compass size={26} /><h2>Live weather is unavailable</h2><p>Try opening this trip again in a few minutes.</p></section>
        )}
        <p className="planning-disclaimer">Trip Scores, activity windows, and packing suggestions are planning guidance—not official warnings or guarantees.</p>
      </main>
    </div>
  );
}
