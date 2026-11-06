/**
 * End-to-end API smoke test against a running dev server.
 *   npx tsx scripts/e2e-api.ts http://localhost:3100 faceA.png faceB.png
 * Creates two throwaway accounts (zzt_<rand>_a/b), runs scan â†’ friends â†’ DM â†’
 * ranked queue â†’ match â†’ result, then deletes everything it created.
 * Costs ~4 AI calls (a few cents).
 */
import fs from "node:fs";
import { Redis } from "@upstash/redis";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const [base, faceA, faceB] = process.argv.slice(2);
const tag = Math.random().toString(36).slice(2, 7);
const users = [`zzt_${tag}_a`, `zzt_${tag}_b`];

class Client {
  cookie = "";
  constructor(public name: string) {}
  async call(path: string, method = "GET", body?: unknown) {
    const r = await fetch(base + path, {
      method,
      // Distinct fake client IP per test client so the per-IP signup limit doesn't trip.
      headers: { "Content-Type": "application/json", Cookie: this.cookie, "x-forwarded-for": `10.9.${tag.length}.${this.name.length}${Math.floor(Math.random() * 9)}` },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const set = r.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data: data as any };
  }
}

const dataUrl = (f: string) => `data:image/jpeg;base64,${fs.readFileSync(f).toString("base64")}`;
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("  âœ“", msg);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [a, b] = users.map((u) => new Client(u));

  console.log("auth");
  for (const c of [a, b]) {
    const r = await c.call("/api/auth/signup", "POST", { username: c.name, password: "testpass123", isOver18: true });
    ok(r.status === 200 && r.data.me?.username === c.name, `signup ${c.name}`);
  }
  ok((await a.call("/api/me")).data.me?.username === a.name, "session cookie works");
  ok((await new Client("x").call("/api/scan", "POST", { frames: [] })).status === 401, "scan requires auth");

  console.log("ranked gate");
  ok((await a.call("/api/match/queue", "POST")).status === 409, "queue refuses unscanned player");

  console.log("scan (AI)");
  const faces = [faceA, faceB];
  for (const [i, c] of [a, b].entries()) {
    const r = await c.call("/api/scan", "POST", { frames: [dataUrl(faces[i])] });
    ok(r.status === 200 && typeof r.data.reading?.overall === "number", `${c.name} scored ${r.data.reading?.overall} (${r.status} ${r.data.message || ""})`);
  }

  console.log("friends + DMs");
  ok((await a.call("/api/messages/" + b.name, "POST", { text: "hi" })).status === 403, "DM blocked before friends");
  ok((await a.call("/api/friends", "POST", { action: "add", username: b.name })).data.relation === "outgoing", "request sent");
  ok((await b.call("/api/friends")).data.incoming?.length === 1, "request received");
  ok((await b.call("/api/friends", "POST", { action: "accept", username: a.name })).data.relation === "friends", "accepted");
  ok((await a.call("/api/messages/" + b.name, "POST", { text: "face-off?" })).status === 200, "DM sent");
  const conv = await b.call("/api/messages");
  ok(conv.data.unread === 1 && conv.data.conversations[0]?.last?.text === "face-off?", "DM delivered + unread");
  ok((await b.call("/api/messages/" + a.name)).data.messages?.length === 1, "thread readable");
  ok((await b.call("/api/messages")).data.unread === 0, "read clears unread");

  console.log("ranked match");
  let matchId: string | null = null;
  for (let i = 0; i < 6 && !matchId; i++) {
    const ra = await a.call("/api/match/queue", "POST");
    const rb = await b.call("/api/match/queue", "POST");
    matchId = ra.data.matchId || rb.data.matchId;
    if (!matchId) await sleep(800);
  }
  ok(matchId, `paired â†’ ${matchId}`);
  const va = (await a.call(`/api/match/${matchId}`)).data.match;
  const vb = (await b.call(`/api/match/${matchId}`)).data.match;
  ok(va.iAmHost !== vb.iAmHost, "exactly one host");

  const host = va.iAmHost ? a : b;
  const guest = va.iAmHost ? b : a;
  ok((await host.call(`/api/match/${matchId}/signal`, "POST", { kind: "offer", sdp: "v=0 test-offer" })).status === 200, "offer posted");
  ok((await guest.call(`/api/match/${matchId}/signal?kind=offer`)).data.sdp === "v=0 test-offer", "guest reads offer");
  ok((await guest.call(`/api/match/${matchId}/signal`, "POST", { kind: "offer", sdp: "x" })).status === 400, "guest can't post offer");

  await a.call(`/api/match/${matchId}/action`, "POST", { action: "ready" });
  const afterReady = (await b.call(`/api/match/${matchId}/action`, "POST", { action: "ready" })).data.match;
  ok(afterReady.state === "live" && afterReady.startAt, "both ready â†’ live with countdown");
  ok((await a.call(`/api/match/${matchId}/frames`, "POST", { frames: [dataUrl(faceA)] })).status === 409, "frames rejected before countdown ends");

  await sleep(Math.max(0, afterReady.startAt - afterReady.serverNow) + 200);
  const [fa, fb] = await Promise.all([
    a.call(`/api/match/${matchId}/frames`, "POST", { frames: [dataUrl(faceA)] }),
    b.call(`/api/match/${matchId}/frames`, "POST", { frames: [dataUrl(faceB)] })
  ]);
  ok(fa.status === 200 && fb.status === 200, "both scored");
  const done = (await a.call(`/api/match/${matchId}`)).data.match;
  ok(done.state === "done", `match done: winner=${done.result?.winner} reason=${done.result?.reason}`);
  console.log("    scores:", Object.fromEntries(Object.entries(done.scores).map(([k, v]: any) => [k, v?.overall])));
  console.log("    elo:", JSON.stringify(done.result?.elo));
  const meA = (await a.call("/api/me")).data.me;
  ok(meA.wins + meA.losses + meA.draws === 1 && meA.placementsLeft === 2, "record + placements updated server-side");

  console.log("private room");
  const room = (await a.call("/api/rooms", "POST")).data.room;
  ok(/^[A-Z2-9]{6}$/.test(room?.code), `room ${room?.code}`);
  ok((await a.call(`/api/rooms/${room.code}`, "POST")).status === 400, "host can't join own room");
  const joined = (await b.call(`/api/rooms/${room.code}`, "POST")).data.room;
  ok(joined.matchId, "guest join creates match");
  ok((await a.call(`/api/rooms/${room.code}`)).data.room.matchId === joined.matchId, "host sees match");
  await a.call(`/api/match/${joined.matchId}/action`, "POST", { action: "leave" });
  ok((await b.call(`/api/match/${joined.matchId}`)).data.match.state === "cancelled", "leaving before start cancels");

  console.log("tournament lobby");
  const t = (await a.call("/api/tourney", "POST")).data.tourney;
  ok((await b.call(`/api/tourney/${t.code}`, "POST", { action: "join" })).data.tourney.players.length === 2, "join tourney");
  ok((await a.call(`/api/tourney/${t.code}`, "POST", { action: "start" })).status === 409, "can't start with 2");

  console.log("badges + avatars");
  await a.call("/api/messages/" + b.name, "POST", { text: "gg" });
  ok((await b.call("/api/me")).data.badges?.unread === 1, "unread badge counts new DM");
  const face = await fetch(`${base}/api/face/${a.name}`);
  ok(face.status === 200 && face.headers.get("content-type") === "image/svg+xml", "no-photo avatar returns initials SVG, not 404");

  console.log("report during match cancels it");
  const room2 = (await a.call("/api/rooms", "POST")).data.room;
  const m2 = (await b.call(`/api/rooms/${room2.code}`, "POST")).data.room.matchId;
  const rep = await a.call("/api/report", "POST", { username: b.name, reason: "harassment", matchId: m2 });
  ok(rep.status === 200 && rep.data.matchCancelled === true, "report filed + match cancelled");
  ok((await b.call(`/api/match/${m2}`)).data.match.state === "cancelled", "opponent sees cancelled");

  console.log("blocking");
  ok((await a.call("/api/blocks", "POST", { action: "block", username: b.name })).status === 200, "block");
  ok((await b.call("/api/messages/" + a.name, "POST", { text: "hey" })).status === 403, "blocked → DM refused (friendship removed)");
  ok((await b.call("/api/friends", "POST", { action: "add", username: a.name })).status === 403, "blocked → friend request refused");
  ok((await a.call(`/api/users/${b.name}`)).data.relation === "blocked", "profile shows blocked");
  const room3 = (await a.call("/api/rooms", "POST")).data.room;
  ok((await b.call(`/api/rooms/${room3.code}`, "POST")).status === 403, "blocked → can't join room");
  let paired = false;
  for (let i = 0; i < 4 && !paired; i++) {
    const ra = await a.call("/api/match/queue", "POST");
    const rb = await b.call("/api/match/queue", "POST");
    paired = !!(ra.data.matchId || rb.data.matchId);
    await sleep(500);
  }
  ok(!paired, "blocked players never paired in ranked");
  await a.call("/api/match/queue", "DELETE");
  await b.call("/api/match/queue", "DELETE");
  ok((await a.call("/api/blocks")).data.blocked?.length === 1, "block list");
  await a.call("/api/blocks", "POST", { action: "unblock", username: b.name });

  console.log("recovery codes");
  const c = new Client(`zzt_${tag}_c`);
  users.push(c.name);
  const su = await c.call("/api/auth/signup", "POST", { username: c.name, password: "oldpass123", isOver18: true });
  const code = su.data.recoveryCode as string;
  ok(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/.test(code), `signup returns recovery code ${code}`);
  const anon = new Client("anon");
  ok((await anon.call("/api/auth/recover", "POST", { username: c.name, code: "AAAA-BBBB-CCCC-DDDD", password: "newpass123" })).status === 401, "wrong code rejected");
  const rec = await anon.call("/api/auth/recover", "POST", { username: c.name, code: code.toLowerCase().replace(/-/g, " "), password: "newpass123" });
  ok(rec.status === 200 && rec.data.recoveryCode && rec.data.recoveryCode !== code, "recover with code (case/format-insensitive) + new code issued");
  ok((await anon.call("/api/me")).data.me?.username === c.name, "signed in after recovery");
  ok((await new Client("x").call("/api/auth/login", "POST", { username: c.name, password: "oldpass123" })).status === 401, "old password dead");
  ok((await new Client("x").call("/api/auth/login", "POST", { username: c.name, password: "newpass123" })).status === 200, "new password works");
  ok((await new Client("y").call("/api/auth/recover", "POST", { username: c.name, code, password: "x123456" })).status === 401, "used code can't be reused");
  ok((await c.call("/api/auth/recovery-code", "POST", { password: "wrong" })).status === 401, "new code needs correct password");
}

async function cleanup() {
  const r = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
  let n = 0;
  for (const u of users) {
    for (const pattern of [`*${u}*`]) {
      let cursor = "0";
      do {
        const [next, keys] = await r.scan(cursor, { match: pattern, count: 500 });
        cursor = String(next);
        if (keys.length) n += await r.del(...keys);
      } while (cursor !== "0");
    }
    await r.zrem("e2:lb", u);
    await r.zrem("e2:queue", u);
  }
  console.log(`cleanup: deleted ${n} keys`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(cleanup);
