import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Redis } from "@upstash/redis";
import { ReplayTheatre } from "@/components/ReplayTheatre";

export const runtime = "edge";
export const revalidate = 60;

type ReplayRound = { criterion: string; me: number; opp: number };
type ReplayDoc = {
  id: string;
  myName: string;
  oppName: string;
  myScore: number;
  oppScore: number;
  won: boolean;
  eloDelta: number;
  rounds: ReplayRound[];
  myFace: string | null;
  oppFace: string | null;
  mode?: string;
  playedAt: number;
};

async function getReplay(id: string): Promise<ReplayDoc | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const redis = Redis.fromEnv();
  const raw = await redis.get<string | object>(`replay:v1:${id}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as ReplayDoc);
}

export default async function ReplayPage({
  params
}: {
  params: { id: string };
}) {
  const r = await getReplay(params.id);
  if (!r) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <ReplayTheatre replay={r} />
      <Footer />
    </main>
  );
}
