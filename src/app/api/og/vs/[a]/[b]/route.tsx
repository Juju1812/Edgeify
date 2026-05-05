import { ImageResponse } from "@vercel/og";
import { Redis } from "@upstash/redis";
import { rankFromElo } from "@/lib/rank";

export const runtime = "edge";

type ProfileSummary = {
  username: string;
  elo: number;
  wins: number;
  losses: number;
  edgeScore: number;
  faceDataUrl: string | null;
};

async function getProfile(username: string): Promise<ProfileSummary | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const redis = Redis.fromEnv();
  const raw = await redis.get<string | object>(
    `lb:summary:v1:${username.toLowerCase()}`
  );
  if (!raw) return null;
  return typeof raw === "string"
    ? (JSON.parse(raw) as ProfileSummary)
    : (raw as ProfileSummary);
}

/**
 * /api/og/vs/[a]/[b] — head-to-head OG image used by the /vs page so
 * shared links preview as a proper "A vs B" card on Twitter / iMessage
 * / Discord etc.
 */
export async function GET(
  _req: Request,
  { params }: { params: { a: string; b: string } }
) {
  const [a, b] = await Promise.all([
    getProfile(params.a),
    getProfile(params.b)
  ]);

  function pane(p: ProfileSummary | null, name: string) {
    if (p) {
      const rank = rankFromElo(p.elo);
      return {
        name: p.username,
        score: p.edgeScore,
        elo: p.elo,
        rankLabel: rank.label,
        rankColor: rank.color,
        rankEmoji: rank.emoji,
        face: p.faceDataUrl
      };
    }
    return {
      name,
      score: 0,
      elo: 0,
      rankLabel: "Unranked",
      rankColor: "#9ca3af",
      rankEmoji: "🌑",
      face: null
    };
  }
  const A = pane(a, params.a);
  const B = pane(b, params.b);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "linear-gradient(135deg, #0a0618 0%, #15113d 50%, #070512 100%)",
          color: "white",
          fontFamily: "ui-monospace, monospace",
          padding: 50,
          position: "relative"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 36,
            left: 60,
            fontSize: 22,
            opacity: 0.5,
            letterSpacing: "0.32em",
            fontWeight: 700
          }}
        >
          EDGIFY · 1V1
        </div>

        {[A, B].map((P, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              border: `3px solid ${P.rankColor}55`,
              borderRadius: 24,
              padding: 28,
              margin: i === 0 ? "60px 12px 0 0" : "60px 0 0 12px"
            }}
          >
            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: 18,
                overflow: "hidden",
                background: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {P.face ? (
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                <img
                  src={P.face}
                  width={220}
                  height={220}
                  style={{ objectFit: "cover", transform: "scaleX(-1)" }}
                />
              ) : (
                <div style={{ fontSize: 120 }}>{P.rankEmoji}</div>
              )}
            </div>
            <div
              style={{ fontSize: 40, fontWeight: 900, letterSpacing: "0.12em" }}
            >
              {P.name}
            </div>
            <div
              style={{
                fontSize: 14,
                color: P.rankColor,
                letterSpacing: "0.32em"
              }}
            >
              {P.rankLabel.toUpperCase()} · {P.elo} ELO
            </div>
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "baseline",
                marginTop: 4
              }}
            >
              <span style={{ fontSize: 60, fontWeight: 900 }}>{P.score}</span>
              <span
                style={{ fontSize: 14, opacity: 0.45, letterSpacing: "0.32em" }}
              >
                EDGE
              </span>
            </div>
          </div>
        ))}

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 96,
            fontWeight: 900,
            background: "linear-gradient(135deg, #22e9ff 0%, #ff5d8f 100%)",
            backgroundClip: "text",
            color: "transparent"
          }}
        >
          VS
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
