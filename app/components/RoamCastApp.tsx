"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  Eye,
  Gauge,
  Heart,
  LocateFixed,
  Map,
  MapPin,
  Menu,
  Navigation,
  Plus,
  Search,
  Snowflake,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  ThermometerSun,
  Trash2,
  Umbrella,
  Waves,
  Wind,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { WeatherMap } from "./WeatherMap";
import type {
  Location,
  StoredState,
  TripPlan,
  UnitSystem,
  WeatherSnapshot,
} from "../types";

export type AppMode = "home" | "destination" | "compare" | "saved";

const STORAGE_KEY = "roamcast:v1";
const LISBON: Location = {
  id: "38.7223,-9.1393",
  name: "Lisbon",
  country: "Portugal",
  region: "Lisbon",
  latitude: 38.7223,
  longitude: -9.1393,
  timezone: "Europe/Lisbon",
};
const TOKYO: Location = {
  id: "35.6762,139.6503",
  name: "Tokyo",
  country: "Japan",
  latitude: 35.6762,
  longitude: 139.6503,
  timezone: "Asia/Tokyo",
};
const REYKJAVIK: Location = {
  id: "64.1466,-21.9426",
  name: "Reykjavík",
  country: "Iceland",
  latitude: 64.1466,
  longitude: -21.9426,
  timezone: "Atlantic/Reykjavik",
};

const EMPTY_STATE: StoredState = {
  version: 1,
  unit: "metric",
  favorites: [],
  recent: [],
  compare: [],
  trips: [],
};

const WEATHER_LABELS: Array<[number, string, LucideIcon]> = [
  [0, "Clear sky", Sun],
  [2, "Mostly clear", CloudSun],
  [3, "Overcast", Cloud],
  [48, "Foggy", CloudFog],
  [57, "Drizzle", CloudDrizzle],
  [67, "Rain", CloudRain],
  [77, "Snow", Snowflake],
  [82, "Rain showers", CloudRain],
  [86, "Snow showers", Snowflake],
  [99, "Thunderstorms", CloudLightning],
];

function weatherMeta(code: number): { label: string; Icon: LucideIcon } {
  const match =
    WEATHER_LABELS.find(([max]) => code <= max) ??
    WEATHER_LABELS[WEATHER_LABELS.length - 1];
  return { label: match[1], Icon: match[2] };
}

function toFahrenheit(celsius: number) {
  return (celsius * 9) / 5 + 32;
}

function temperature(value: number, unit: UnitSystem, sign = true) {
  const converted = unit === "imperial" ? toFahrenheit(value) : value;
  return sign
    ? `${Math.round(converted)}°${unit === "imperial" ? "F" : "C"}`
    : `${Math.round(converted)}`;
}

function speed(value: number, unit: UnitSystem) {
  return unit === "imperial"
    ? `${Math.round(value * 0.621371)} mph`
    : `${Math.round(value)} km/h`;
}

function distance(value: number, unit: UnitSystem) {
  const km = value / 1000;
  return unit === "imperial"
    ? `${(km * 0.621371).toFixed(1)} mi`
    : `${km.toFixed(1)} km`;
}

function precipitation(value: number, unit: UnitSystem) {
  return unit === "imperial"
    ? `${(value / 25.4).toFixed(2)} in`
    : `${Math.round(value)} mm`;
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

function localDay(date: string, timezone?: string, weekday = "short") {
  return new Intl.DateTimeFormat("en", {
    weekday: weekday as "short" | "long",
    month: "short",
    day: "numeric",
    timeZone: timezone || "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function localTime(date: string, timezone?: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone || "UTC",
  }).format(new Date(date));
}

function dateInput(offset = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
}

function storageRead(): StoredState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
    if (parsed?.version === 1) return { ...EMPTY_STATE, ...parsed };
  } catch {
    // Treat malformed or older storage as a fresh local profile.
  }
  return EMPTY_STATE;
}

function storageWrite(next: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="stat-card">
      <span className="stat-icon">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </div>
    </div>
  );
}

function ForecastIcon({ code, size = 24 }: { code: number; size?: number }) {
  const { Icon, label } = weatherMeta(code);
  return <Icon size={size} aria-label={label} />;
}

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="RoamCast home">
      <span className="brand-mark">
        <Navigation size={19} aria-hidden="true" />
      </span>
      <span>RoamCast</span>
    </Link>
  );
}

function EmptyPanel({
  title,
  body,
  icon: Icon = Compass,
}: {
  title: string;
  body: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty-panel">
      <span className="empty-icon">
        <Icon size={26} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export function RoamCastApp({ mode }: { mode: AppMode }) {
  const [state, setState] = useState<StoredState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [activeLocation, setActiveLocation] = useState<Location>(LISBON);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [compareWeather, setCompareWeather] = useState<WeatherSnapshot[]>([]);
  const [loading, setLoading] = useState(mode !== "saved");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(-1);
  const [mobileNav, setMobileNav] = useState(false);
  const [startDate, setStartDate] = useState(dateInput(1));
  const [endDate, setEndDate] = useState(dateInput(5));
  const searchRef = useRef<HTMLDivElement>(null);

  const persist = useCallback(
    (updater: (previous: StoredState) => StoredState) => {
      setState((previous) => {
        const next = updater(previous);
        storageWrite(next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const stored = storageRead();
    const params = new URLSearchParams(window.location.search);
    const latitude = Number(params.get("lat"));
    const longitude = Number(params.get("lon"));
    let initialLocation = stored.lastLocation ?? LISBON;
    if (
      mode === "destination" &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      initialLocation = {
        id: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
        name: params.get("name") || "Destination",
        country: params.get("country") || "",
        region: params.get("region") || undefined,
        latitude,
        longitude,
      };
    }
    const nextState =
      mode === "compare" && stored.compare.length === 0
        ? { ...stored, compare: [LISBON, TOKYO, REYKJAVIK] }
        : stored;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setState(nextState);
      setActiveLocation(initialLocation);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (!hydrated || mode === "saved" || mode === "compare") return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      lat: String(activeLocation.latitude),
      lon: String(activeLocation.longitude),
      name: activeLocation.name,
      country: activeLocation.country,
    });
    if (activeLocation.region) params.set("region", activeLocation.region);

    fetch(`/api/weather?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Live weather unavailable");
        return (await response.json()) as WeatherSnapshot;
      })
      .then((snapshot) => {
        setWeather(snapshot);
        persist((previous) => ({
          ...previous,
          lastLocation: activeLocation,
          lastForecast: snapshot,
        }));
      })
      .catch((reason) => {
        if (reason.name === "AbortError") return;
        const cached = state.lastForecast;
        if (cached?.location.id === activeLocation.id) {
          setWeather({ ...cached, stale: true });
          setError("Showing the last saved forecast while live data reconnects.");
        } else {
          setError("We couldn’t reach the forecast. Check your connection and try again.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // State is deliberately excluded to avoid refetching after cache persistence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocation, hydrated, mode, persist]);

  useEffect(() => {
    if (!hydrated || mode !== "compare" || state.compare.length === 0) return;
    const controller = new AbortController();
    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations: state.compare }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Comparison unavailable");
        const data = (await response.json()) as {
          snapshots: WeatherSnapshot[];
        };
        setCompareWeather(data.snapshots);
      })
      .catch((reason) => {
        if (reason.name !== "AbortError") {
          setError("Destination comparison is temporarily unavailable.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [hydrated, mode, state.compare]);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearching(true);
      fetch(`/api/locations?q=${encodeURIComponent(query.trim())}&language=en`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Search unavailable");
          const data = (await response.json()) as { locations: Location[] };
          setResults(data.locations);
          setActiveResult(data.locations.length ? 0 : -1);
        })
        .catch((reason) => {
          if (reason.name !== "AbortError") setResults([]);
        })
        .finally(() => setSearching(false));
    }, 260);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, []);

  const selectLocation = useCallback(
    (place: Location) => {
      const recent = [
        place,
        ...state.recent.filter((item) => item.id !== place.id),
      ].slice(0, 6);
      if (mode === "compare") {
        if (state.compare.some((item) => item.id === place.id)) {
          setError(`${place.name} is already in your comparison.`);
        } else if (state.compare.length >= 3) {
          setError("Remove a destination before adding another.");
        } else {
          setLoading(true);
          persist((previous) => ({
            ...previous,
            recent,
            compare: [...previous.compare, place],
          }));
          setError("");
        }
      } else {
        persist((previous) => ({ ...previous, recent, lastLocation: place }));
        window.location.href = locationHref(place);
      }
      setQuery("");
      setResults([]);
      setSearchOpen(false);
    },
    [mode, persist, state.compare, state.recent],
  );

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResult((value) => (value + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResult((value) =>
        value <= 0 ? results.length - 1 : value - 1,
      );
    } else if (event.key === "Enter" && activeResult >= 0) {
      event.preventDefault();
      selectLocation(results[activeResult]);
    } else if (event.key === "Escape") {
      setSearchOpen(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Location isn’t available in this browser. Search for a city instead.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const place: Location = {
          id: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
          name: "Your location",
          country: "",
          latitude,
          longitude,
        };
        setActiveLocation(place);
        persist((previous) => ({ ...previous, lastLocation: place }));
        setLoading(false);
      },
      () => {
        setLoading(false);
        setError("Location access was declined. Search for a destination instead.");
      },
      { timeout: 9000, maximumAge: 600000 },
    );
  };

  const toggleFavorite = (place: Location) => {
    const exists = state.favorites.some((item) => item.id === place.id);
    persist((previous) => ({
      ...previous,
      favorites: exists
        ? previous.favorites.filter((item) => item.id !== place.id)
        : [
            {
              ...place,
              savedAt: new Date().toISOString(),
            },
            ...previous.favorites,
          ].slice(0, 8),
    }));
  };

  const removeCompare = (id: string) => {
    setLoading(true);
    persist((previous) => ({
      ...previous,
      compare: previous.compare.filter((place) => place.id !== id),
    }));
  };

  const unit = state.unit;
  const isFavorite = state.favorites.some(
    (item) => item.id === activeLocation.id,
  );
  const searchId = "destination-search-results";

  return (
    <div
      className={`app-shell ${weather?.current.isDay === false ? "night" : ""}`}
    >
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <header className="site-header">
        <Brand />
        <nav className={mobileNav ? "main-nav open" : "main-nav"}>
          <Link className={mode === "home" ? "active" : ""} href="/">
            Forecast
          </Link>
          <Link className={mode === "compare" ? "active" : ""} href="/compare">
            Compare
          </Link>
          <Link className={mode === "saved" ? "active" : ""} href="/saved">
            Saved
          </Link>
        </nav>
        <div className="header-actions">
          <button
            className="unit-toggle"
            type="button"
            aria-label={`Switch to ${unit === "metric" ? "Fahrenheit" : "Celsius"}`}
            onClick={() =>
              persist((previous) => ({
                ...previous,
                unit: previous.unit === "metric" ? "imperial" : "metric",
              }))
            }
          >
            <span className={unit === "metric" ? "selected" : ""}>°C</span>
            <span className={unit === "imperial" ? "selected" : ""}>°F</span>
          </button>
          <button
            className="menu-button"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={mobileNav}
            onClick={() => setMobileNav((value) => !value)}
          >
            {mobileNav ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <main>
        <section className="search-row" aria-label="Destination search">
          <div className="search-wrap" ref={searchRef}>
            <Search size={20} aria-hidden="true" />
            <input
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                if (value.trim().length < 2) {
                  setResults([]);
                  setSearching(false);
                  setActiveResult(-1);
                }
                setSearchOpen(true);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder={
                mode === "compare"
                  ? "Add a destination to compare"
                  : "Search city, region, or postcode"
              }
              aria-label="Search destinations"
              aria-controls={searchId}
              aria-expanded={searchOpen}
              aria-autocomplete="list"
              role="combobox"
            />
            {searching && <span className="search-loader" aria-label="Searching" />}
            {searchOpen && (
              <div className="search-popover" id={searchId} role="listbox">
                {query.trim().length < 2 && state.recent.length > 0 && (
                  <>
                    <span className="popover-label">Recent searches</span>
                    {state.recent.map((place) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected="false"
                        key={place.id}
                        onClick={() => selectLocation(place)}
                      >
                        <MapPin size={16} />
                        <span>
                          <strong>{place.name}</strong>
                          <small>
                            {[place.region, place.country]
                              .filter(Boolean)
                              .join(", ")}
                          </small>
                        </span>
                        <ArrowRight size={15} />
                      </button>
                    ))}
                  </>
                )}
                {query.trim().length >= 2 &&
                  !searching &&
                  results.length === 0 && (
                    <p className="search-empty">
                      No matching destination found. Try a nearby city.
                    </p>
                  )}
                {results.map((place, index) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={activeResult === index}
                    className={activeResult === index ? "highlighted" : ""}
                    key={place.id}
                    onMouseEnter={() => setActiveResult(index)}
                    onClick={() => selectLocation(place)}
                  >
                    <MapPin size={16} />
                    <span>
                      <strong>{place.name}</strong>
                      <small>
                        {[place.region, place.country].filter(Boolean).join(", ")}
                      </small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            )}
          </div>
          {mode !== "compare" && (
            <button className="location-button" type="button" onClick={useMyLocation}>
              <LocateFixed size={18} />
              <span>Use my location</span>
            </button>
          )}
        </section>

        {error && (
          <div className="notice" role="status">
            <AlertTriangle size={17} />
            <span>{error}</span>
            <button type="button" aria-label="Dismiss notice" onClick={() => setError("")}>
              <X size={15} />
            </button>
          </div>
        )}

        {mode === "saved" ? (
          <SavedView
            state={state}
            onRemove={(place) => toggleFavorite(place)}
            onDeleteTrip={(id) =>
              persist((previous) => ({
                ...previous,
                trips: previous.trips.filter((trip) => trip.id !== id),
              }))
            }
          />
        ) : mode === "compare" ? (
          <CompareView
            locations={state.compare}
            snapshots={compareWeather}
            loading={loading}
            unit={unit}
            startDate={startDate}
            endDate={endDate}
            onStartDate={setStartDate}
            onEndDate={setEndDate}
            onRemove={removeCompare}
            onSaveTrip={(trip) =>
              persist((previous) => ({
                ...previous,
                trips: [trip, ...previous.trips].slice(0, 12),
              }))
            }
          />
        ) : (
          <ForecastView
            weather={weather}
            loading={loading}
            unit={unit}
            detailed={mode === "destination"}
            favorite={isFavorite}
            onToggleFavorite={() => toggleFavorite(activeLocation)}
          />
        )}
      </main>

      <footer>
        <div>
          <Brand />
          <p>Go where the weather feels right.</p>
        </div>
        <p>
          Weather data by{" "}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
          . Map data © OpenStreetMap contributors.
        </p>
      </footer>
    </div>
  );
}

function ForecastView({
  weather,
  loading,
  unit,
  detailed,
  favorite,
  onToggleFavorite,
}: {
  weather: WeatherSnapshot | null;
  loading: boolean;
  unit: UnitSystem;
  detailed: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  if (loading && !weather) {
    return (
      <div className="forecast-loading" role="status">
        <span />
        <p>Reading the skies…</p>
      </div>
    );
  }
  if (!weather) {
    return (
      <EmptyPanel
        title="Choose your next stop"
        body="Search for a city or use your location to see a live travel forecast."
      />
    );
  }

  const meta = weatherMeta(weather.current.weatherCode);
  const today = weather.daily[0];
  const nowIndex = Math.max(
    0,
    weather.hourly.findIndex((hour) => hour.time >= weather.current.observedAt),
  );
  const upcoming = weather.hourly.slice(nowIndex, nowIndex + 12);
  const dayName = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: weather.timezone,
  }).format(new Date());
  const mapTemperatures = {
    [weather.location.id]: temperature(weather.current.temperature, unit),
  };

  return (
    <>
      <section className="weather-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <MapPin size={15} />
            <span>
              {[weather.location.name, weather.location.country]
                .filter(Boolean)
                .join(", ")}
            </span>
            <span className="live-dot">Live</span>
          </div>
          <div className="hero-temperature">
            {temperature(weather.current.temperature, unit, false)}°
          </div>
          <div className="condition-line">
            <meta.Icon size={25} />
            <strong>{meta.label}</strong>
            <span>
              Feels like {temperature(weather.current.apparentTemperature, unit)}
            </span>
          </div>
          <p className="hero-summary">
            {weather.current.precipitation > 0
              ? "Pack a light layer and keep an umbrella close."
              : weather.current.windGusts >= 35
                ? "A breezy day for exploring—secure loose layers."
                : "Comfortable conditions for a day of exploring."}
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={onToggleFavorite}>
              <Heart size={17} fill={favorite ? "currentColor" : "none"} />
              {favorite ? "Saved destination" : "Save destination"}
            </button>
            {!detailed && (
              <Link href={locationHref(weather.location)} className="secondary-button">
                Full forecast <ArrowRight size={17} />
              </Link>
            )}
          </div>
        </div>

        <div className="hero-orbit" aria-hidden="true">
          <div className="sun-orb">
            <meta.Icon size={94} strokeWidth={1.25} />
          </div>
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
        </div>

        <aside className="today-brief">
          <div>
            <span>{dayName}</span>
            <small>
              Updated {localTime(weather.current.observedAt, weather.timezone)}
            </small>
          </div>
          <div className="high-low">
            <span>High</span>
            <strong>{temperature(today?.temperatureMax ?? 0, unit)}</strong>
            <span>Low</span>
            <strong>{temperature(today?.temperatureMin ?? 0, unit)}</strong>
          </div>
          <div className="sun-times">
            <span>
              <Sunrise size={16} />{" "}
              {today?.sunrise ? localTime(today.sunrise, weather.timezone) : "—"}
            </span>
            <span>
              <Sunset size={16} />{" "}
              {today?.sunset ? localTime(today.sunset, weather.timezone) : "—"}
            </span>
          </div>
        </aside>
      </section>

      {weather.risks.length > 0 ? (
        <section className="risk-strip" aria-label="Travel planning guidance">
          <div className="risk-heading">
            <span>
              <AlertTriangle size={18} />
            </span>
            <div>
              <strong>Travel watch</strong>
              <small>Planning guidance, not an emergency warning</small>
            </div>
          </div>
          <div className="risk-items">
            {weather.risks.slice(0, 2).map((risk) => (
              <article key={risk.id}>
                <span>{localDay(risk.date, weather.timezone)}</span>
                <strong>{risk.title}</strong>
                <p>{risk.detail}</p>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="all-clear">
          <span>
            <Check size={17} />
          </span>
          <div>
            <strong>No major travel disruptions in the outlook</strong>
            <p>Conditions can change. Check again before heading out.</p>
          </div>
        </section>
      )}

      <section className="content-grid">
        <div className="panel hourly-panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Next 12 hours</span>
              <h2>Your day, hour by hour</h2>
            </div>
            <Waves size={22} />
          </div>
          <div className="hourly-scroll">
            {upcoming.map((hour, index) => (
              <article className={index === 0 ? "hour-card now" : "hour-card"} key={hour.time}>
                <span>{index === 0 ? "Now" : localTime(hour.time, weather.timezone)}</span>
                <ForecastIcon code={hour.weatherCode} size={23} />
                <strong>{temperature(hour.temperature, unit, false)}°</strong>
                <small>
                  <Droplets size={12} /> {Math.round(hour.precipitationProbability)}%
                </small>
              </article>
            ))}
          </div>
        </div>

        <div className="panel quick-panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Right now</span>
              <h2>Travel essentials</h2>
            </div>
          </div>
          <div className="stats-grid">
            <Stat icon={Wind} label="Wind" value={speed(weather.current.windSpeed, unit)} />
            <Stat icon={Droplets} label="Humidity" value={`${Math.round(weather.current.humidity)}%`} />
            <Stat icon={Gauge} label="Pressure" value={`${Math.round(weather.current.pressure)} hPa`} />
            <Stat icon={Cloud} label="Cloud cover" value={`${Math.round(weather.current.cloudCover)}%`} />
          </div>
        </div>
      </section>

      <section className="panel daily-panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">10-day outlook</span>
            <h2>Plan the whole stay</h2>
          </div>
          <Link href="/compare" className="text-link">
            Compare destinations <ArrowRight size={16} />
          </Link>
        </div>
        <div className="daily-list">
          {weather.daily.slice(0, 10).map((day, index) => (
            <article key={day.date}>
              <div className="day-name">
                <strong>{index === 0 ? "Today" : localDay(day.date, weather.timezone).split(",")[0]}</strong>
                <span>{localDay(day.date, weather.timezone).split(",").slice(1).join(",")}</span>
              </div>
              <div className="day-condition">
                <ForecastIcon code={day.weatherCode} size={24} />
                <span>{weatherMeta(day.weatherCode).label}</span>
              </div>
              <div className="day-rain">
                <Droplets size={15} />
                <span>{Math.round(day.precipitationProbability)}%</span>
              </div>
              <div className="day-wind">
                <Wind size={15} />
                <span>{speed(day.windSpeedMax, unit)}</span>
              </div>
              <div className="day-temps">
                <strong>{temperature(day.temperatureMax, unit, false)}°</strong>
                <span>{temperature(day.temperatureMin, unit, false)}°</span>
                <i
                  style={{
                    "--range-start": `${Math.max(0, Math.min(70, day.temperatureMin + 20))}%`,
                    "--range-end": `${Math.max(30, Math.min(100, day.temperatureMax + 45))}%`,
                  } as React.CSSProperties}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      {detailed && (
        <>
          <section className="details-grid">
            <div className="panel map-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Around you</span>
                  <h2>Destination map</h2>
                </div>
                <Map size={21} />
              </div>
              <WeatherMap
                locations={[weather.location]}
                temperatures={mapTemperatures}
              />
            </div>
            <div className="panel detail-stats">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Know before you go</span>
                  <h2>Atmosphere & visibility</h2>
                </div>
              </div>
              <div className="detail-stat-grid">
                <Stat
                  icon={Eye}
                  label="Visibility"
                  value={distance(upcoming[0]?.visibility ?? 0, unit)}
                  note="Current estimate"
                />
                <Stat
                  icon={Umbrella}
                  label="Rain today"
                  value={precipitation(today?.precipitation ?? 0, unit)}
                  note={`${Math.round(today?.precipitationProbability ?? 0)}% chance`}
                />
                <Stat
                  icon={ThermometerSun}
                  label="UV index"
                  value={`${Math.round(today?.uvIndexMax ?? 0)}`}
                  note={
                    (today?.uvIndexMax ?? 0) >= 6
                      ? "Protection recommended"
                      : "Low to moderate"
                  }
                />
                <Stat
                  icon={Wind}
                  label="Strongest gust"
                  value={speed(today?.windGustsMax ?? 0, unit)}
                  note="Today"
                />
              </div>
            </div>
          </section>
          <section className="travel-note">
            <Sparkles size={21} />
            <div>
              <span className="section-kicker">RoamCast tip</span>
              <h2>
                {weather.current.precipitation > 0
                  ? "Keep indoor plans within easy reach."
                  : weather.current.apparentTemperature >= 32
                    ? "Start early and save the afternoon for shade."
                    : "A good day to explore on foot."}
              </h2>
              <p>
                This guidance is generated from forecast thresholds and should
                complement official local advice.
              </p>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function CompareView({
  locations,
  snapshots,
  loading,
  unit,
  startDate,
  endDate,
  onStartDate,
  onEndDate,
  onRemove,
  onSaveTrip,
}: {
  locations: Location[];
  snapshots: WeatherSnapshot[];
  loading: boolean;
  unit: UnitSystem;
  startDate: string;
  endDate: string;
  onStartDate: (value: string) => void;
  onEndDate: (value: string) => void;
  onRemove: (id: string) => void;
  onSaveTrip: (trip: TripPlan) => void;
}) {
  const [saved, setSaved] = useState(false);
  const forecastEnd = dateInput(15);
  const withinRange =
    startDate >= dateInput(0) &&
    startDate <= forecastEnd &&
    endDate >= startDate &&
    endDate <= forecastEnd;
  const temperatures = Object.fromEntries(
    snapshots.map((snapshot) => [
      snapshot.location.id,
      temperature(snapshot.current.temperature, unit),
    ]),
  );

  const saveTrip = () => {
    onSaveTrip({
      id: `${Date.now()}`,
      name: locations.map((place) => place.name).join(" · "),
      locations,
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return (
    <>
      <section className="compare-intro">
        <div>
          <span className="section-kicker">Weather side by side</span>
          <h1>Find your best forecast.</h1>
          <p>
            Compare up to three destinations across the same travel dates—then
            save the shortlist for later.
          </p>
        </div>
        <div className="trip-dates">
          <label>
            <span>From</span>
            <input
              type="date"
              value={startDate}
              min={dateInput(0)}
              onChange={(event) => onStartDate(event.target.value)}
            />
          </label>
          <span className="date-arrow">
            <ArrowRight size={17} />
          </span>
          <label>
            <span>To</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => onEndDate(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={!locations.length}
            onClick={saveTrip}
          >
            {saved ? <Check size={17} /> : <Heart size={17} />}
            {saved ? "Trip saved" : "Save trip"}
          </button>
        </div>
      </section>

      {!withinRange && (
        <div className="range-notice">
          <CalendarDays size={19} />
          <div>
            <strong>Live forecast not available yet</strong>
            <p>
              Save this trip now. Forecasts appear when the dates enter the
              16-day live window.
            </p>
          </div>
        </div>
      )}

      <div className="compare-chips">
        {locations.map((place) => (
          <span key={place.id}>
            <MapPin size={14} /> {place.name}
            <button
              type="button"
              onClick={() => onRemove(place.id)}
              aria-label={`Remove ${place.name}`}
            >
              <X size={14} />
            </button>
          </span>
        ))}
        {locations.length < 3 && (
          <span className="add-chip">
            <Plus size={14} /> Search above to add
          </span>
        )}
      </div>

      {loading ? (
        <div className="forecast-loading compact" role="status">
          <span />
          <p>Comparing destinations…</p>
        </div>
      ) : locations.length === 0 ? (
        <EmptyPanel
          title="Build your shortlist"
          body="Search for up to three destinations to compare their travel weather."
          icon={Plus}
        />
      ) : (
        <section className="compare-grid">
          {snapshots.map((snapshot, index) => {
            const meta = weatherMeta(snapshot.current.weatherCode);
            const selectedDays = withinRange
              ? snapshot.daily.filter(
                  (day) => day.date >= startDate && day.date <= endDate,
                )
              : [];
            return (
              <article className={`compare-card card-${index + 1}`} key={snapshot.location.id}>
                <div className="compare-card-head">
                  <div>
                    <span>
                      <MapPin size={14} /> {snapshot.location.country}
                    </span>
                    <h2>{snapshot.location.name}</h2>
                  </div>
                  <Link
                    href={locationHref(snapshot.location)}
                    aria-label={`Open ${snapshot.location.name} forecast`}
                  >
                    <ArrowRight size={17} />
                  </Link>
                </div>
                <div className="compare-current">
                  <div>
                    <meta.Icon size={42} strokeWidth={1.4} />
                    <span>{meta.label}</span>
                  </div>
                  <strong>{temperature(snapshot.current.temperature, unit, false)}°</strong>
                </div>
                <div className="compare-mini-stats">
                  <span>
                    <Droplets size={15} />{" "}
                    {Math.round(snapshot.daily[0]?.precipitationProbability ?? 0)}%
                  </span>
                  <span>
                    <Wind size={15} /> {speed(snapshot.current.windSpeed, unit)}
                  </span>
                </div>
                {selectedDays.length > 0 ? (
                  <div className="compare-days">
                    {selectedDays.slice(0, 6).map((day) => (
                      <div key={day.date}>
                        <span>{localDay(day.date, snapshot.timezone).split(",")[0]}</span>
                        <ForecastIcon code={day.weatherCode} size={18} />
                        <strong>{temperature(day.temperatureMax, unit, false)}°</strong>
                        <small>{temperature(day.temperatureMin, unit, false)}°</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-live-days">Save now and check back closer to departure.</p>
                )}
                <div className="compare-verdict">
                  {snapshot.risks.length ? (
                    <>
                      <AlertTriangle size={17} />
                      <span>{snapshot.risks[0].title} in the outlook</span>
                    </>
                  ) : (
                    <>
                      <Check size={17} />
                      <span>Clear travel outlook</span>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {locations.length > 0 && (
        <section className="panel compare-map-panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Across the map</span>
              <h2>Your destination shortlist</h2>
            </div>
            <Map size={21} />
          </div>
          <WeatherMap locations={locations} temperatures={temperatures} />
        </section>
      )}
    </>
  );
}

function SavedView({
  state,
  onRemove,
  onDeleteTrip,
}: {
  state: StoredState;
  onRemove: (place: Location) => void;
  onDeleteTrip: (id: string) => void;
}) {
  return (
    <>
      <section className="saved-intro">
        <div>
          <span className="section-kicker">Your travel weatherboard</span>
          <h1>Saved for wherever’s next.</h1>
          <p>
            Destinations and trip shortlists stay on this device—no account
            required.
          </p>
        </div>
        <div className="saved-count">
          <Heart size={21} />
          <strong>{state.favorites.length}</strong>
          <span>saved places</span>
        </div>
      </section>

      <section className="saved-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Favorites</span>
            <h2>Places you’re watching</h2>
          </div>
          <span className="limit-note">{state.favorites.length}/8 saved</span>
        </div>
        {state.favorites.length ? (
          <div className="saved-grid">
            {state.favorites.map((place, index) => (
              <article key={place.id} className={`saved-card tone-${(index % 3) + 1}`}>
                <div>
                  <span>
                    <MapPin size={14} /> {place.country || "Saved location"}
                  </span>
                  <h3>{place.name}</h3>
                  <p>{place.region || "Ready for your next forecast check"}</p>
                </div>
                <div className="saved-card-actions">
                  <Link href={locationHref(place)}>
                    View forecast <ArrowRight size={16} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => onRemove(place)}
                    aria-label={`Remove ${place.name} from saved places`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyPanel
            title="No saved destinations yet"
            body="Open any destination forecast and tap “Save destination” to keep it here."
            icon={Heart}
          />
        )}
      </section>

      <section className="saved-section trips-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Trip shortlists</span>
            <h2>Plans worth checking again</h2>
          </div>
          <Link href="/compare" className="text-link">
            New comparison <Plus size={16} />
          </Link>
        </div>
        {state.trips.length ? (
          <div className="trip-list">
            {state.trips.map((trip) => {
              const isLive = trip.startDate <= dateInput(15);
              return (
                <article key={trip.id}>
                  <span className="trip-calendar">
                    <CalendarDays size={20} />
                  </span>
                  <div className="trip-copy">
                    <h3>{trip.name || "Weather shortlist"}</h3>
                    <p>
                      {localDay(trip.startDate)} — {localDay(trip.endDate)}
                    </p>
                    <div>
                      {trip.locations.map((place) => (
                        <span key={place.id}>{place.name}</span>
                      ))}
                    </div>
                  </div>
                  <span className={isLive ? "trip-status live" : "trip-status"}>
                    {isLive ? "Live forecast ready" : "Waiting for forecast window"}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => onDeleteTrip(trip.id)}
                    aria-label={`Delete trip ${trip.name}`}
                  >
                    <Trash2 size={17} />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyPanel
            title="No trip shortlists yet"
            body="Compare destinations and save the dates that matter to you."
            icon={CalendarDays}
          />
        )}
      </section>
    </>
  );
}
