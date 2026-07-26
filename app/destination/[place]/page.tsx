import type { Metadata } from "next";
import { RoamCastApp } from "../../components/RoamCastApp";

export const metadata: Metadata = {
  title: "Destination forecast — RoamCast",
  description:
    "Explore an hourly and 10-day destination forecast with travel guidance.",
};

export default function DestinationPage() {
  return <RoamCastApp mode="destination" />;
}

