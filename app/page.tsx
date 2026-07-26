import type { Metadata } from "next";
import { RoamCastApp } from "./components/RoamCastApp";

export const metadata: Metadata = {
  title: "RoamCast — Travel weather at a glance",
  description:
    "Live forecasts, destination comparisons, and practical travel weather guidance.",
};

export default function Home() {
  return <RoamCastApp mode="home" />;
}

