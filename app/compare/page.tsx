import type { Metadata } from "next";
import { RoamCastApp } from "../components/RoamCastApp";

export const metadata: Metadata = {
  title: "Compare destinations — RoamCast",
  description:
    "Compare travel weather for up to three destinations across the same dates.",
};

export default function ComparePage() {
  return <RoamCastApp mode="compare" />;
}

