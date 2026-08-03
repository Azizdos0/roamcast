import type { Metadata } from "next";
import { RoamCastApp } from "../components/RoamCastApp";

export const metadata: Metadata = {
  title: "Explore destinations — RoamCast",
  description:
    "Find destinations whose live forecasts match your dates and travel preferences.",
};

export default function ExplorePage() {
  return <RoamCastApp mode="explore" />;
}
