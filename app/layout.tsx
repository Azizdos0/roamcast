import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const base = host ? `${protocol}://${host}` : "https://roamcast.site";

  return {
    title: {
      default: "RoamCast — Go where the weather feels right",
      template: "%s",
    },
    description:
      "A live travel weatherboard for forecasts, destination comparisons, saved places, and practical planning guidance.",
    applicationName: "RoamCast",
    metadataBase: new URL(base),
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      siteName: "RoamCast",
      title: "RoamCast — Go where the weather feels right",
      description:
        "Compare destinations, watch the weather, and plan your next trip with confidence.",
      images: [
        {
          url: `${base}/og.png`,
          width: 1659,
          height: 948,
          alt: "RoamCast travel weather dashboard",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "RoamCast — Go where the weather feels right",
      description:
        "Compare destinations, watch the weather, and plan your next trip with confidence.",
      images: [`${base}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
