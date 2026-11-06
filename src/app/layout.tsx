import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/lib/client/session";
import { Nav } from "@/components/nav";
import "./globals.css";

// SF Pro is used automatically on Apple devices (-apple-system); Inter is
// the closest match everywhere else.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://edgify.cc"),
  title: { default: "Edgify — your face, scored by AI", template: "%s · Edgify" },
  description:
    "Scan your face and get an honest AI looks score with a trait-by-trait breakdown. Then face off live, 1v1, and climb the leaderboard.",
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
  openGraph: {
    title: "Edgify — your face, scored by AI",
    description: "An honest AI looks score, live 1v1 face-offs and a global leaderboard.",
    url: "https://edgify.cc",
    siteName: "Edgify",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 628, alt: "Edgify" }]
  },
  twitter: { card: "summary_large_image", images: ["/og.jpg"] },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  themeColor: "#f5f5f7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen">
        <SessionProvider>
          <Nav />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
