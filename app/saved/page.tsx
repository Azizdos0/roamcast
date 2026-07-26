import type { Metadata } from "next";
import { RoamCastApp } from "../components/RoamCastApp";

export const metadata: Metadata = {
  title: "Saved trips — RoamCast",
  description:
    "Revisit locally saved destinations and weather comparison shortlists.",
};

export default function SavedPage() {
  return <RoamCastApp mode="saved" />;
}

