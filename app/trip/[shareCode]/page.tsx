import type { Metadata } from "next";
import { SharedTripView } from "../../components/SharedTripView";
import { decodeSharedTrip } from "../../lib/share-trip";

type Props = { params: Promise<{ shareCode: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareCode } = await params;
  const payload = decodeSharedTrip(shareCode);
  if (!payload) {
    return {
      title: "Invalid trip link — RoamCast",
      description: "This shared RoamCast trip link is not valid.",
    };
  }
  const destinations = payload.locations.map((place) => place.name).join(" vs ");
  return {
    title: `${payload.name || destinations} — RoamCast`,
    description: `A shared travel-weather brief for ${destinations}, from ${payload.startDate} to ${payload.endDate}.`,
  };
}

export default async function SharedTripPage({ params }: Props) {
  const { shareCode } = await params;
  return <SharedTripView payload={decodeSharedTrip(shareCode)} />;
}
