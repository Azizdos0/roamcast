import type {
  DestinationCatalogEntry,
  DestinationRegion,
  TravelStyle,
} from "../types";

type CatalogStyle = Exclude<TravelStyle, "custom">;

function destination(
  name: string,
  country: string,
  latitude: number,
  longitude: number,
  timezone: string,
  catalogRegion: DestinationRegion,
  styles: CatalogStyle[],
  region?: string,
): DestinationCatalogEntry {
  return {
    id: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
    name,
    country,
    region,
    latitude,
    longitude,
    timezone,
    catalogRegion,
    styles,
  };
}

export const DESTINATION_CATALOG: DestinationCatalogEntry[] = [
  destination("Lisbon", "Portugal", 38.7223, -9.1393, "Europe/Lisbon", "europe", ["beach", "city"], "Lisbon"),
  destination("Barcelona", "Spain", 41.3874, 2.1686, "Europe/Madrid", "europe", ["beach", "city"], "Catalonia"),
  destination("Rome", "Italy", 41.9028, 12.4964, "Europe/Rome", "europe", ["city"], "Lazio"),
  destination("Paris", "France", 48.8566, 2.3522, "Europe/Paris", "europe", ["city"], "Ile-de-France"),
  destination("London", "United Kingdom", 51.5072, -0.1276, "Europe/London", "europe", ["city"], "England"),
  destination("Amsterdam", "Netherlands", 52.3676, 4.9041, "Europe/Amsterdam", "europe", ["city"], "North Holland"),
  destination("Berlin", "Germany", 52.52, 13.405, "Europe/Berlin", "europe", ["city"], "Berlin"),
  destination("Prague", "Czechia", 50.0755, 14.4378, "Europe/Prague", "europe", ["city"], "Prague"),
  destination("Vienna", "Austria", 48.2082, 16.3738, "Europe/Vienna", "europe", ["city"], "Vienna"),
  destination("Athens", "Greece", 37.9838, 23.7275, "Europe/Athens", "europe", ["beach", "city"], "Attica"),
  destination("Dubrovnik", "Croatia", 42.6507, 18.0944, "Europe/Zagreb", "europe", ["beach", "city"], "Dubrovnik-Neretva"),
  destination("Reykjavik", "Iceland", 64.1466, -21.9426, "Atlantic/Reykjavik", "europe", ["outdoors", "winter"], "Capital Region"),
  destination("Tromso", "Norway", 69.6492, 18.9553, "Europe/Oslo", "europe", ["outdoors", "winter"], "Troms"),
  destination("Zurich", "Switzerland", 47.3769, 8.5417, "Europe/Zurich", "europe", ["city", "outdoors", "winter"], "Zurich"),

  destination("Tokyo", "Japan", 35.6762, 139.6503, "Asia/Tokyo", "asia", ["city"], "Tokyo"),
  destination("Kyoto", "Japan", 35.0116, 135.7681, "Asia/Tokyo", "asia", ["city", "outdoors"], "Kyoto"),
  destination("Seoul", "South Korea", 37.5665, 126.978, "Asia/Seoul", "asia", ["city", "winter"], "Seoul"),
  destination("Bangkok", "Thailand", 13.7563, 100.5018, "Asia/Bangkok", "asia", ["city"], "Bangkok"),
  destination("Singapore", "Singapore", 1.3521, 103.8198, "Asia/Singapore", "asia", ["city"], "Singapore"),
  destination("Bali", "Indonesia", -8.65, 115.2167, "Asia/Makassar", "asia", ["beach", "outdoors"], "Bali"),
  destination("Kuala Lumpur", "Malaysia", 3.139, 101.6869, "Asia/Kuala_Lumpur", "asia", ["city"], "Kuala Lumpur"),
  destination("Hanoi", "Vietnam", 21.0278, 105.8342, "Asia/Bangkok", "asia", ["city"], "Hanoi"),
  destination("Ho Chi Minh City", "Vietnam", 10.8231, 106.6297, "Asia/Ho_Chi_Minh", "asia", ["city"], "Ho Chi Minh"),
  destination("Taipei", "Taiwan", 25.033, 121.5654, "Asia/Taipei", "asia", ["city", "outdoors"], "Taipei"),
  destination("Hong Kong", "Hong Kong", 22.3193, 114.1694, "Asia/Hong_Kong", "asia", ["city", "outdoors"], "Hong Kong"),
  destination("Beijing", "China", 39.9042, 116.4074, "Asia/Shanghai", "asia", ["city", "winter"], "Beijing"),
  destination("Shanghai", "China", 31.2304, 121.4737, "Asia/Shanghai", "asia", ["city"], "Shanghai"),
  destination("Phuket", "Thailand", 7.8804, 98.3923, "Asia/Bangkok", "asia", ["beach", "outdoors"], "Phuket"),

  destination("Dubai", "United Arab Emirates", 25.2048, 55.2708, "Asia/Dubai", "middle-east-africa", ["beach", "city"], "Dubai"),
  destination("Riyadh", "Saudi Arabia", 24.7136, 46.6753, "Asia/Riyadh", "middle-east-africa", ["city"], "Riyadh"),
  destination("Muscat", "Oman", 23.588, 58.3829, "Asia/Muscat", "middle-east-africa", ["beach", "outdoors"], "Muscat"),
  destination("Doha", "Qatar", 25.2854, 51.531, "Asia/Qatar", "middle-east-africa", ["beach", "city"], "Doha"),
  destination("Marrakech", "Morocco", 31.6295, -7.9811, "Africa/Casablanca", "middle-east-africa", ["city", "outdoors"], "Marrakech-Safi"),
  destination("Cairo", "Egypt", 30.0444, 31.2357, "Africa/Cairo", "middle-east-africa", ["city"], "Cairo"),
  destination("Cape Town", "South Africa", -33.9249, 18.4241, "Africa/Johannesburg", "middle-east-africa", ["beach", "city", "outdoors"], "Western Cape"),
  destination("Nairobi", "Kenya", -1.2921, 36.8219, "Africa/Nairobi", "middle-east-africa", ["city", "outdoors"], "Nairobi County"),

  destination("New York", "United States", 40.7128, -74.006, "America/New_York", "north-america", ["city", "winter"], "New York"),
  destination("Los Angeles", "United States", 34.0522, -118.2437, "America/Los_Angeles", "north-america", ["beach", "city"], "California"),
  destination("San Francisco", "United States", 37.7749, -122.4194, "America/Los_Angeles", "north-america", ["city", "outdoors"], "California"),
  destination("Miami", "United States", 25.7617, -80.1918, "America/New_York", "north-america", ["beach", "city"], "Florida"),
  destination("Honolulu", "United States", 21.3099, -157.8581, "Pacific/Honolulu", "north-america", ["beach", "outdoors"], "Hawaii"),
  destination("Vancouver", "Canada", 49.2827, -123.1207, "America/Vancouver", "north-america", ["city", "outdoors", "winter"], "British Columbia"),
  destination("Toronto", "Canada", 43.6532, -79.3832, "America/Toronto", "north-america", ["city", "winter"], "Ontario"),
  destination("Montreal", "Canada", 45.5017, -73.5673, "America/Toronto", "north-america", ["city", "winter"], "Quebec"),
  destination("Mexico City", "Mexico", 19.4326, -99.1332, "America/Mexico_City", "north-america", ["city"], "Mexico City"),
  destination("Denver", "United States", 39.7392, -104.9903, "America/Denver", "north-america", ["city", "outdoors", "winter"], "Colorado"),

  destination("Rio de Janeiro", "Brazil", -22.9068, -43.1729, "America/Sao_Paulo", "latin-america-caribbean", ["beach", "city", "outdoors"], "Rio de Janeiro"),
  destination("Buenos Aires", "Argentina", -34.6037, -58.3816, "America/Argentina/Buenos_Aires", "latin-america-caribbean", ["city"], "Buenos Aires"),
  destination("Lima", "Peru", -12.0464, -77.0428, "America/Lima", "latin-america-caribbean", ["city"], "Lima"),
  destination("Cartagena", "Colombia", 10.391, -75.4794, "America/Bogota", "latin-america-caribbean", ["beach", "city"], "Bolivar"),
  destination("San Jose", "Costa Rica", 9.9281, -84.0907, "America/Costa_Rica", "latin-america-caribbean", ["city", "outdoors"], "San Jose"),
  destination("Cancun", "Mexico", 21.1619, -86.8515, "America/Cancun", "latin-america-caribbean", ["beach"], "Quintana Roo"),
  destination("Punta Cana", "Dominican Republic", 18.5601, -68.3725, "America/Santo_Domingo", "latin-america-caribbean", ["beach"], "La Altagracia"),
  destination("Santiago", "Chile", -33.4489, -70.6693, "America/Santiago", "latin-america-caribbean", ["city", "outdoors", "winter"], "Santiago Metropolitan"),

  destination("Sydney", "Australia", -33.8688, 151.2093, "Australia/Sydney", "oceania", ["beach", "city", "outdoors"], "New South Wales"),
  destination("Melbourne", "Australia", -37.8136, 144.9631, "Australia/Melbourne", "oceania", ["city"], "Victoria"),
  destination("Brisbane", "Australia", -27.4698, 153.0251, "Australia/Brisbane", "oceania", ["beach", "city", "outdoors"], "Queensland"),
  destination("Auckland", "New Zealand", -36.8509, 174.7645, "Pacific/Auckland", "oceania", ["beach", "city", "outdoors"], "Auckland"),
  destination("Queenstown", "New Zealand", -45.0312, 168.6626, "Pacific/Auckland", "oceania", ["outdoors", "winter"], "Otago"),
  destination("Nadi", "Fiji", -17.7765, 177.4356, "Pacific/Fiji", "oceania", ["beach", "outdoors"], "Western Division"),
];

export const DESTINATION_REGIONS: Array<{
  value: DestinationRegion | "all";
  label: string;
}> = [
  { value: "all", label: "Anywhere" },
  { value: "europe", label: "Europe" },
  { value: "asia", label: "Asia" },
  { value: "middle-east-africa", label: "Middle East & Africa" },
  { value: "north-america", label: "North America" },
  { value: "latin-america-caribbean", label: "Latin America & Caribbean" },
  { value: "oceania", label: "Oceania" },
];
