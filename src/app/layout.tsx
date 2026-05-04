import type { Metadata, Viewport } from "next";
import { UserProvider } from "@/lib/user-context";
import { ToastProvider } from "@/lib/toast-context";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Edgify — Ranked 1v1 Face-Offs",
  description:
    "Live 1v1 face-offs scored by AI on geometric facial measurements. Climb the seasonal ranked ladder against real opponents — no bots, no filters. EdgeScore is an entertainment metric, not an objective beauty judgment.",
  keywords: ["edgify", "edgescore", "face-off", "ranked", "1v1", "leaderboard"],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  },
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
          <ToastProvider>
            <div className="relative z-10">{children}</div>
            <KeyboardShortcuts />
          </ToastProvider>
        </UserProvider>
      </body>
    </html>
  );
}
