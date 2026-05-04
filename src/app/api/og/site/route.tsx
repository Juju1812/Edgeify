import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

/**
 * Site-level Open Graph image. Rendered when anyone shares an Edgify
 * link without a specific username — so iMessage, Discord, X, etc.
 * all show a clean branded card instead of a generic preview.
 *
 * 1200x630 (Twitter/Discord), bold and unmistakable.
 */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#04060c",
          backgroundImage:
            "radial-gradient(60% 50% at 18% 10%, rgba(34,233,255,0.28) 0%, rgba(8,12,28,0) 60%), radial-gradient(55% 45% at 82% 92%, rgba(255,93,143,0.22) 0%, rgba(8,12,28,0) 65%)",
          color: "#fff",
          fontFamily: "Inter, sans-serif",
          padding: "60px"
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            color: "#22e9ff",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            marginBottom: 24
          }}
        >
          Ranked 1v1 Face-offs
        </div>
        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            fontSize: 220,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            backgroundImage: "linear-gradient(120deg, #22e9ff, #b9f8ff 30%, #ff5d8f 80%)",
            backgroundClip: "text",
            color: "transparent"
          }}
        >
          EDGIFY
        </div>
        {/* Sub */}
        <div
          style={{
            display: "flex",
            color: "rgba(255,255,255,0.7)",
            fontSize: 32,
            fontWeight: 600,
            marginTop: 24
          }}
        >
          AI-scored face-off platform
        </div>
        {/* Footer */}
        <div
          style={{
            display: "flex",
            color: "rgba(255,255,255,0.45)",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            marginTop: 64,
            fontFamily: "ui-monospace, monospace"
          }}
        >
          edgify.cc
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
