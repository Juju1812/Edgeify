import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COACH_PROMPT = `You are a no-nonsense aesthetic coach for a competitive 1v1 face-off platform. The user is a player asking for one paragraph of actionable advice based on their recent match performance.

INPUT: a JSON summary of their last 8-15 matches with round-by-round scores per criterion (Symmetry, Jawline, Cheekbones, Proportions, Overall), plus their wins/losses, ELO, and overall EdgeScore breakdown if provided.

OUTPUT RULES:
- One short paragraph (3-5 sentences). No headings, no bullets, no preamble.
- Identify the single weakest criterion based on their losses; tie it to a concrete, lawful, non-invasive change (lighting, head angle, grooming, posture, framing).
- Be specific to the data — quote average scores or trends.
- Neutral coach tone — no slang, no insults, no compliments-without-reason.
- End with a single concrete next step they can do today.
- Do NOT recommend cosmetic procedures, surgery, drugs, or extreme dieting.`;

type Body = {
  summary?: {
    matches: Array<{
      won: boolean;
      myScore: number;
      oppScore: number;
      eloDelta: number;
      rounds?: Array<{ criterion: string; me: number; opp: number }>;
    }>;
    elo: number;
    wins: number;
    losses: number;
    edgeScore?: Record<string, number>;
  };
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "coach_disabled", message: "Coach isn't configured." },
      { status: 503 }
    );
  }

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!body.summary || !Array.isArray(body.summary.matches)) {
    return NextResponse.json({ error: "missing_summary" }, { status: 400 });
  }
  if (body.summary.matches.length < 3) {
    return NextResponse.json(
      {
        error: "not_enough_data",
        message: "Play a few matches first — coach needs data."
      },
      { status: 400 }
    );
  }

  // Trim the summary to keep token cost low.
  const trimmed = {
    elo: body.summary.elo,
    wins: body.summary.wins,
    losses: body.summary.losses,
    edgeScore: body.summary.edgeScore,
    matches: body.summary.matches.slice(0, 15).map((m) => ({
      won: m.won,
      score: `${m.myScore}-${m.oppScore}`,
      eloDelta: m.eloDelta,
      rounds: m.rounds?.map((r) => ({
        criterion: r.criterion,
        me: r.me,
        opp: r.opp
      }))
    }))
  };

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: COACH_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here's my recent performance:\n\n${JSON.stringify(trimmed, null, 2)}\n\nGive me one paragraph of coaching.`
        }
      ]
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return NextResponse.json({ tip: text });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json(
      {
        error: "anthropic_error",
        message: err.message || "Coach failed."
      },
      { status: err.status || 500 }
    );
  }
}
