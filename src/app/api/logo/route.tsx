import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

/**
 * GET /api/logo — 512x512 PNG of the Edgify mark, ready for use as a
 * Discord server icon, Twitter avatar, etc. Right-click → Save Image.
 *
 * The hexagon ring is an inline SVG (works reliably in @vercel/og).
 * The "E" glyph is built from four positioned divs with CSS linear-
 * gradient backgrounds, because @vercel/og won't render SVG <line>
 * elements that reference a <linearGradient id="..."> inside the same
 * SVG — they come out invisible.
 */
export async function GET() {
  const grad = "linear-gradient(135deg, #22e9ff 0%, #b9f8ff 50%, #ff5d8f 100%)";
  const stroke = 22; // E stroke width in px (canvas is 512x512)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 50% 50%, #1a0f3d 0%, #0a0618 60%, #04060c 100%)",
          position: "relative"
        }}
      >
        {/* Ambient cyan corner glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 360,
            height: 360,
            background:
              "radial-gradient(circle, rgba(34,233,255,0.18), transparent 65%)"
          }}
        />
        {/* Ambient coral corner glow */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 360,
            height: 360,
            background:
              "radial-gradient(circle, rgba(255,93,143,0.16), transparent 65%)"
          }}
        />

        {/* Hexagon ring — pure SVG, no gradient refs (uses solid white +
            CSS-style gradient via stroke isn't supported, so we draw two
            half-rings with hard-coded colors and let them blend). */}
        <svg
          width="380"
          height="380"
          viewBox="0 0 380 380"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: "absolute" }}
        >
          <defs>
            <linearGradient id="hex" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22e9ff" />
              <stop offset="50%" stopColor="#b9f8ff" />
              <stop offset="100%" stopColor="#ff5d8f" />
            </linearGradient>
          </defs>
          <path
            d="M190 30 L328 110 L328 270 L190 350 L52 270 L52 110 Z"
            fill="none"
            stroke="url(#hex)"
            strokeWidth="14"
            strokeLinejoin="round"
          />
        </svg>

        {/* The E — built from positioned divs so @vercel/og renders them
            reliably. Coordinates are around the canvas center (256, 256). */}
        <div
          style={{
            position: "absolute",
            left: 256 - 70,   // x-start of left bar
            top: 256 - 90,    // y-start of left bar
            width: stroke,
            height: 180,
            background: grad,
            borderRadius: stroke / 2
          }}
        />
        {/* Top horizontal */}
        <div
          style={{
            position: "absolute",
            left: 256 - 70,
            top: 256 - 90,
            width: 130,
            height: stroke,
            background: grad,
            borderRadius: stroke / 2
          }}
        />
        {/* Middle horizontal — slightly shorter */}
        <div
          style={{
            position: "absolute",
            left: 256 - 70,
            top: 256 - stroke / 2,
            width: 100,
            height: stroke,
            background: grad,
            borderRadius: stroke / 2
          }}
        />
        {/* Bottom horizontal */}
        <div
          style={{
            position: "absolute",
            left: 256 - 70,
            top: 256 + 90 - stroke,
            width: 130,
            height: stroke,
            background: grad,
            borderRadius: stroke / 2
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            position: "absolute",
            bottom: 56,
            fontFamily: "ui-monospace, monospace",
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 9,
            color: "rgba(255,255,255,0.92)"
          }}
        >
          EDGIFY
        </div>
      </div>
    ),
    {
      width: 512,
      height: 512,
      headers: {
        "cache-control": "public, max-age=86400, s-maxage=86400"
      }
    }
  );
}
