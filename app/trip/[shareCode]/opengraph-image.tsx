import { ImageResponse } from "next/og";
import { decodeSharedTrip } from "../../lib/share-trip";

export const alt = "Shared RoamCast travel-weather plan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const { shareCode } = await params;
  const payload = decodeSharedTrip(shareCode);
  const title = payload?.name || payload?.locations.map((place) => place.name).join(" · ") || "RoamCast trip";
  const dates = payload ? `${payload.startDate} – ${payload.endDate}` : "Shared travel-weather plan";
  const style = payload ? `${payload.preferences.style[0].toUpperCase()}${payload.preferences.style.slice(1)} profile` : "Weather-first planning";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "68px",
        color: "white",
        background: "linear-gradient(135deg, #103f46 0%, #176b78 52%, #55a99c 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", fontSize: 28, fontWeight: 700 }}>
        <span style={{ display: "flex", marginRight: 14, width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.18)" }}>↗</span>
        RoamCast
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 970 }}>
        <span style={{ display: "flex", fontSize: 23, color: "#bce9e1", marginBottom: 18 }}>{style}</span>
        <div style={{ display: "flex", fontSize: 66, lineHeight: 1.05, fontWeight: 800, letterSpacing: "-2px" }}>{title}</div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 24, color: "#e8fffb" }}>{dates}</div>
      </div>
      <div style={{ display: "flex", fontSize: 21, color: "#d6f4ee" }}>Live forecasts · Trip Scores · Best weather windows</div>
    </div>,
    size,
  );
}
