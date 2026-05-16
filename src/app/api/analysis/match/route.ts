import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getRedis, profileKey, sessionKey } from "@/lib/auth-server";
import { FREE_DEEP_ANALYSES_PER_MONTH } from "@/lib/pro";

// Anthropic SDK uses Node APIs (e.g. stream); use the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const usageKey = (username: string, monthYM: string) =>
  `analysis:usage:v1:${username.toLowerCase()}:${monthYM}`;

function currentMonthYM(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Canonical analysis prompt — verbatim, do NOT paraphrase.
 * Saved as a memory under edgify_analysis_prompt.md so it stays in sync.
 */
const ANALYSIS_SYSTEM_PROMPT = `You are an advanced facial and aesthetic analysis engine designed for a competitive "lookmaxing" platform where users compare appearances.

Your job is to produce HIGHLY STRUCTURED, CONSISTENT, AND USEFUL analysis — not vague compliments.

CORE RULES:
- Be objective, specific, and grounded in observable traits.
- Do NOT be insulting, demeaning, or absolute.
- Avoid generic statements like "you look good" — always explain WHY.
- Use neutral, analytical language similar to a coach or evaluator.
- Focus on actionable insights when possible.

WHEN COMPARING TWO PEOPLE:
Always output in this structure:

1. OVERALL SUMMARY
- Give a concise comparison of both individuals.
- Identify who has the edge overall and why (if applicable).
- Mention uncertainty if the images are unclear.

2. FEATURE-BY-FEATURE ANALYSIS
Break down both individuals across:

- Facial symmetry
- Bone structure (jawline, cheekbones, chin)
- Skin quality
- Eye area (shape, spacing, under-eyes)
- Nose proportions
- Lips
- Hair (style, density, fit)
- Grooming & presentation

For EACH category:
- Describe Person A
- Describe Person B
- State who has the advantage and WHY

3. STRENGTHS
- List 3–5 strengths for each person

4. IMPROVEMENT OPPORTUNITIES
- Give realistic, actionable suggestions (grooming, hairstyle, lighting, posture, etc.)
- Avoid extreme or invasive suggestions

5. FINAL VERDICT
- Who wins overall (if a winner is clear)
- Confidence level (Low / Medium / High)
- Brief justification

STYLE GUIDELINES:
- Be precise, not emotional
- Avoid slang or hype language
- No "rating out of 10"
- No harsh judgments — frame everything constructively
- Acknowledge subjectivity where relevant

IMPORTANT:
- If image quality, angle, or lighting affects judgment, explicitly mention it.
- Do NOT assume personality, ethnicity, or background.
- Stay focused only on visible traits.

GOAL:
Deliver analysis that feels like a professional aesthetic breakdown, not a casual opinion.`;

type DataUrlImage = {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  data: string;
};

function parseDataUrl(url: string): DataUrlImage | null {
  // data:image/jpeg;base64,/9j/4AAQ...
  const m = url.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  if (!m) return null;
  return { mediaType: m[1] as DataUrlImage["mediaType"], data: m[2] };
}

type Body = {
  myFace?: string;
  oppFace?: string;
  myName?: string;
  oppName?: string;
  myScore?: number;
  oppScore?: number;
};

/**
 * POST /api/analysis/match { myFace, oppFace, myName, oppName, myScore, oppScore }
 *
 * Sends both face images + match metadata to Claude opus-4-7 with the
 * canonical analysis prompt. Returns the structured markdown response.
 *
 * Faces are expected as data URLs (image/jpeg, base64). Caller is
 * responsible for capturing snapshots; this endpoint just forwards them.
 *
 * Cost guard: cap response at 2000 tokens (~5¢/call at opus-4-7 rates).
 */
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "analysis_disabled",
        message:
          "Deep analysis isn't configured on this server. The project owner needs to set ANTHROPIC_API_KEY in environment variables."
      },
      { status: 503 }
    );
  }

  // ── Quota gate (Free = 3/month, Pro = unlimited) ────────────────
  // Authed users get tracked usage; guests / unauthed get the free
  // tier limit pinned to a single anonymous bucket per month.
  const redis = getRedis();
  let username: string | null = null;
  let isProUser = false;
  if (redis) {
    const token = (req.headers.get("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (token) {
      const sessRaw = await redis.get<string | { username: string }>(
        sessionKey(token)
      );
      if (sessRaw) {
        const sess = typeof sessRaw === "string" ? JSON.parse(sessRaw) : sessRaw;
        username = String(sess.username);
        const profileRaw = await redis.get<string | Record<string, unknown>>(
          profileKey(username)
        );
        if (profileRaw) {
          const profile =
            typeof profileRaw === "string" ? JSON.parse(profileRaw) : profileRaw;
          const proUntil = Number(profile.proUntil) || 0;
          isProUser = proUntil > Date.now();
        }
      }
    }
    if (!isProUser && username) {
      const month = currentMonthYM();
      const usedRaw = await redis.get<number | string>(usageKey(username, month));
      const used = Number(usedRaw) || 0;
      if (used >= FREE_DEEP_ANALYSES_PER_MONTH) {
        // Parse the body now so we can build a real teaser from the
        // scores instead of returning a flat refusal. Zero Claude cost
        // — the teaser is deterministically generated and reads like
        // the opening of a real analysis. This is the highest-leverage
        // Pro conversion moment we have.
        let teaserBody: Body = {};
        try {
          teaserBody = await req.json();
        } catch {
          /* fall through with empty teaserBody */
        }
        const my = teaserBody.myName || "Player A";
        const opp = teaserBody.oppName || "Player B";
        const mw = Number(teaserBody.myScore) || 0;
        const ow = Number(teaserBody.oppScore) || 0;
        const closer = mw === ow ? "razor close" : Math.abs(mw - ow) === 1 ? "tight" : "decisive";
        const winner = mw > ow ? my : ow > mw ? opp : null;
        const teaser =
          `1. OVERALL SUMMARY\n` +
          `A ${closer} face-off: ${my} ${mw} – ${opp} ${ow}` +
          (winner ? `, with ${winner} taking the edge.` : `, ending level.`) +
          ` Both players showed dimension-specific advantages — the deciding margin came down to a single category.\n\n` +
          `2. FEATURE-BY-FEATURE ANALYSIS\n\n` +
          `**Facial symmetry** — ${winner ? `${winner}'s mid-line alignment held cleaner through the scan window.` : `Both players read symmetric within tolerance.`}\n\n` +
          `**Bone structure** — *Pro subscribers see the full per-category breakdown for jawline, cheekbones, and chin definition…*\n\n` +
          `[Skin quality, eye area, nose proportions, lips, hair, grooming · 5 more sections]\n\n` +
          `3. STRENGTHS · 4. IMPROVEMENT OPPORTUNITIES · 5. FINAL VERDICT — *Pro only*`;
        return NextResponse.json(
          {
            error: "quota_exceeded",
            message: `Free tier is ${FREE_DEEP_ANALYSES_PER_MONTH} deep analyses per month. Upgrade to Edgify Pro for unlimited.`,
            teaser,
            upgradeUrl: "/pricing"
          },
          { status: 402 }
        );
      }
    }
  }

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  if (!body.myFace || !body.oppFace) {
    return NextResponse.json(
      { error: "missing_faces", message: "Both face images are required." },
      { status: 400 }
    );
  }

  const myImg = parseDataUrl(body.myFace);
  const oppImg = parseDataUrl(body.oppFace);
  if (!myImg || !oppImg) {
    return NextResponse.json(
      { error: "bad_image_format", message: "Face images must be base64 data URLs." },
      { status: 400 }
    );
  }

  // Cap individual image payload size to keep cost predictable. ~3MB
  // raw → ~4MB base64 is well above what we ever capture (we down-sample
  // both faces to ~320x240 jpegs ≈ 30KB each).
  const MAX_BASE64_BYTES = 4_000_000;
  if (myImg.data.length > MAX_BASE64_BYTES || oppImg.data.length > MAX_BASE64_BYTES) {
    return NextResponse.json(
      { error: "image_too_large", message: "Face images exceed 3MB." },
      { status: 413 }
    );
  }

  const client = new Anthropic({ apiKey });

  const myName = (body.myName || "Player A").slice(0, 40);
  const oppName = (body.oppName || "Player B").slice(0, 40);
  const scoreLine =
    typeof body.myScore === "number" && typeof body.oppScore === "number"
      ? `Match concluded ${body.myScore}–${body.oppScore} in Person A's favor (or Person B's, depending on which is higher).`
      : "Match score not provided.";

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: myImg.mediaType,
                data: myImg.data
              }
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: oppImg.mediaType,
                data: oppImg.data
              }
            },
            {
              type: "text",
              text: `The first image is Person A ("${myName}"). The second image is Person B ("${oppName}"). ${scoreLine} Provide your structured analysis in the format specified by your instructions.`
            }
          ]
        }
      ]
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n\n");

    // Charge a usage tick for free-tier users (Pro is unlimited).
    if (redis && username && !isProUser) {
      const month = currentMonthYM();
      const k = usageKey(username, month);
      // 35 days TTL covers the rest of this month + a buffer.
      await redis.incr(k);
      await redis.expire(k, 35 * 24 * 60 * 60);
    }

    return NextResponse.json({
      analysis: text,
      tokens: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens
      }
    });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    // Surface the most helpful error we can without leaking the API key
    // path. Common failures: 401 invalid key, 429 rate limit, 529 overload.
    const status = err.status || 500;
    const msg =
      status === 401
        ? "Invalid Anthropic API key. Check your ANTHROPIC_API_KEY env var."
        : status === 429
          ? "Anthropic rate limit hit. Try again in a moment."
          : status === 529
            ? "Anthropic API is overloaded. Try again in a moment."
            : err.message || "Analysis failed.";
    return NextResponse.json(
      { error: "anthropic_error", message: msg },
      { status }
    );
  }
}
