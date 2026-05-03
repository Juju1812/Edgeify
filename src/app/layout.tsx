import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MogOff — Ranked 1v1 Face-Offs",
  description:
    "MogOff is an entertainment platform that scores webcam selfies on geometric facial measurements (symmetry, proportions, jawline) and pits players in 1v1 ranked matches. MogScore is a fun metric, not an objective beauty judgment.",
  keywords: ["mogoff", "face-off", "ranked", "1v1", "leaderboard"],
  openGraph: {
    title: "MogOff",
    description: "Ranked 1v1 face-offs. Climb the leaderboard.",
    type: "website"
  },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  themeColor: "#0a0618",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="relative min-h-screen antialiased">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
