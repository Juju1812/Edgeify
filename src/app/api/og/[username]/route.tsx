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
  return typeof raw === "string" ? JSON.parse(raw) : (raw as ProfileSummary);
}

export async function GET(
  _req: Request,
  { params }: { params: { username: string } }
) {
  const profile = await getProfile(params.username);

  // Fallback "not ranked" card.
  if (!profile) {
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
              "linear-gradient(135deg, #0a0618 0%, #15113d 50%, #070512 100%)",
            color: "white",
            fontFamily: "ui-monospace, monospace"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 36, opacity: 0.5, letterSpacing: "0.32em" }}>
              EDGIFY
            </div>
            <div style={{ fontSize: 72, fontWeight: 900, marginTop: 16 }}>
              {params.username}
            </div>
            <div style={{ fontSize: 28, marginTop: 24, opacity: 0.6 }}>
              Not yet ranked
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const rank = rankFromElo(profile.elo);
  const total = profile.wins + profile.losses;
  const winRate = total > 0 ? Math.round((profile.wins / total) * 100) : 0;

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
          padding: 60
        }}
      >
        {/* Brand mark */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 60,
            fontSize: 24,
            opacity: 0.5,
            letterSpacing: "0.32em",
            fontWeight: 700
          }}
        >
          EDGIFY · S1
        </div>

        {/* Face panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 400,
            height: 510,
            marginRight: 60,
            marginTop: 60,
            border: `4px solid ${rank.color}66`,
            borderRadius: 24,
            overflow: "hidden",
            background: "#000"
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#000"
            }}
          >
            {profile.faceDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img
                src={profile.faceDataUrl}
                width={400}
                height={400}
                style={{ objectFit: "cover", transform: "scaleX(-1)" }}
              />
            ) : (
              <div style={{ fontSize: 200 }}>{rank.emoji}</div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "16px 0",
              background: "rgba(0,0,0,0.6)"
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.18em" }}>
              {profile.username}
            </div>
            <div
              style={{
                fontSize: 14,
                marginTop: 6,
                color: rank.color,
                letterSpacing: "0.32em"
              }}
            >
              {rank.emoji} {rank.label}
            </div>
          </div>
        </div>

        {/* Stats column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1
          }}
        >
          <div
            style={{
              fontSize: 28,
              opacity: 0.4,
              letterSpacing: "0.32em",
              marginBottom: 8
            }}
          >
            ELO
          </div>
          <div
            style={{
              fontSize: 140,
              fontWeight: 900,
              color: "#22d3ee",
              lineHeight: 1
            }}
          >
            {profile.elo}
          </div>
          <div style={{ display: "flex", gap: 32, marginTop: 32, fontSize: 22 }}>
            <Stat label="W/L" value={`${profile.wins}/${profile.losses}`} />
            <Stat label="WIN RATE" value={`${winRate}%`} />
            <Stat label="EDGESCORE" value={String(profile.edgeScore)} />
          </div>
          <div
            style={{
              marginTop: 40,
              fontSize: 18,
              opacity: 0.4,
              letterSpacing: "0.22em"
            }}
          >
            edgify · ranked 1v1 face-offs
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          fontSize: 14,
          opacity: 0.4,
          letterSpacing: "0.32em",
          marginBottom: 6
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
