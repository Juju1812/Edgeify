import type { Metadata, Viewport } from "next";
import { UserProvider } from "@/lib/user-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Edgify — Ranked 1v1 Face-Offs",
  description:
    "Edgify is an entertainment platform that scores webcam selfies on geometric facial measurements (symmetry, proportions, jawline) and pits players in 1v1 ranked matches. EdgeScore is a fun metric, not an objective beauty judgment.",
  keywords: ["edgify", "face-off", "ranked", "1v1", "leaderboard"],
  openGraph: {
    title: "Edgify",
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
        <UserProvider>
          <div className="relative z-10">{children}</div>
        </UserProvider>
      </body>
    </html>
  );
}
