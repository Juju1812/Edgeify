import type { Metadata, Viewport } from "next";
import { UserProvider } from "@/lib/user-context";
import { ToastProvider } from "@/lib/toast-context";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { BugReportButton } from "@/components/BugReportButton";
import { PerfClass } from "@/components/PerfClass";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { AutoCountry } from "@/components/AutoCountry";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://edgify.cc"),
  title: "Edgify — AI-scored 1v1 face-offs",
  description:
    "Live 1v1 face-offs scored by AI on geometric facial measurements. Climb the seasonal ranked ladder against real opponents — no bots, no filters. EdgeScore is an entertainment metric, not an objective beauty judgment.",
  keywords: [
    "edgify",
    "edgescore",
    "face-off",
    "ranked",
    "1v1",
    "leaderboard",
    "looksmaxxing",
    "face rating",
    "AI face score"
  ],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  },
  openGraph: {
    title: "Edgify — AI-scored 1v1 face-offs",
    description:
      "Real opponents, AI scoring, ELO ladder. Free, no account required.",
    type: "website",
    url: "https://edgify.cc",
    siteName: "Edgify",
    images: [
      {
        url: "/api/og/site",
        width: 1200,
        height: 630,
        alt: "Edgify"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Edgify — AI-scored 1v1 face-offs",
    description:
      "Real opponents, AI scoring, ELO ladder. Free, no account required.",
    images: ["/api/og/site"]
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
          <ToastProvider>
            <PerfClass />
            <AutoCountry />
            <div className="relative z-10">{children}</div>
            <KeyboardShortcuts />
            <BugReportButton />
            <PWAInstallPrompt />
          </ToastProvider>
        </UserProvider>
      </body>
    </html>
  );
}
