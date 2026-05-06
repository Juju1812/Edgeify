import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

/**
 * GET /api/logo — 512x512 PNG of the Edgify mark, ready for use as a
 * Discord server icon, Twitter avatar, etc. Right-click → Save Image
 * gives you a clean PNG.
 */
export async function GET() {
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
            background: "radial-gradient(circle, rgba(34,233,255,0.18), transparent 65%)"
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
            background: "radial-gradient(circle, rgba(255,93,143,0.16), transparent 65%)"
          }}
        />

        {/* Hex + E mark */}
        <svg
          width="380"
          height="380"
          viewBox="0 0 380 380"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22e9ff" />
              <stop offset="50%" stopColor="#b9f8ff" />
              <stop offset="100%" stopColor="#ff5d8f" />
            </linearGradient>
          </defs>
          <g transform="translate(190 190)">
            <path
              d="M0 -160 L138 -80 L138 80 L0 160 L-138 80 L-138 -80 Z"
              fill="none"
              stroke="url(#brand)"
              strokeWidth="14"
              strokeLinejoin="round"
            />
            <line
              x1="-64"
              y1="-70"
              x2="54"
              y2="-70"
              stroke="url(#brand)"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <line
              x1="-64"
              y1="0"
              x2="32"
              y2="0"
              stroke="url(#brand)"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <line
              x1="-64"
              y1="70"
              x2="54"
              y2="70"
              stroke="url(#brand)"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <line
              x1="-64"
              y1="-82"
              x2="-64"
              y2="82"
              stroke="url(#brand)"
              strokeWidth="20"
              strokeLinecap="round"
            />
          </g>
        </svg>

        {/* Wordmark */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
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
