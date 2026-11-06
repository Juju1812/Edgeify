/**
 * Visual check: screenshot every page (desktop + phone) with real data.
 *   npx tsx scripts/shots.ts http://localhost:3100 <outDir> faceA.jpg faceB.jpg
 * Uses the installed Microsoft Edge via playwright-core. Creates two
 * throwaway accounts and deletes them afterwards. ~2 AI calls.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { Redis } from "@upstash/redis";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const [base, outDir, faceA, faceB] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const tag = Math.random().toString(36).slice(2, 6);
const A = `Maya_${tag}`;
const B = `Noah_${tag}`;

async function call(cookie: string, p: string, method = "GET", body?: unknown) {
  const r = await fetch(base + p, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const set = r.headers.get("set-cookie");
  return { cookie: set ? set.split(";")[0] : cookie, data: (await r.json().catch(() => ({}))) as any, status: r.status };
}

const jpg = (f: string) => `data:image/jpeg;base64,${fs.readFileSync(f).toString("base64")}`;

async function main() {
  let ca = (await call("", "/api/auth/signup", "POST", { username: A, password: "testpass123", isOver18: true })).cookie;
  let cb = (await call("", "/api/auth/signup", "POST", { username: B, password: "testpass123", isOver18: true })).cookie;
  console.log("scan A", (await call(ca, "/api/scan", "POST", { frames: [jpg(faceA)], thumb: jpg(faceA) })).status);
  console.log("scan B", (await call(cb, "/api/scan", "POST", { frames: [jpg(faceB)], thumb: jpg(faceB) })).status);
  await call(ca, "/api/friends", "POST", { action: "add", username: B });
  await call(cb, "/api/friends", "POST", { action: "accept", username: A });
  await call(cb, "/api/messages/" + A, "POST", { text: "you've been on a run today 👀" });
  await call(ca, "/api/messages/" + B, "POST", { text: "Face-off? Join my room: " + base + "/play/room/ABC234" });
  await call(cb, "/api/messages/" + A, "POST", { text: "you're on" });

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const shots: [string, string, boolean][] = [
    ["landing", "/", false],
    ["login", "/login", false],
    ["home", "/", true],
    ["scan", "/scan", true],
    ["play", "/play", true],
    ["leaderboard", "/leaderboard", true],
    ["friends", "/friends", true],
    ["messages", "/friends?tab=messages", true],
    ["thread", `/friends/${B}`, true],
    ["profile", `/u/${B}`, true],
    ["settings", "/settings", true]
  ];
  for (const [vw, vh, label, mobile] of [
    [1440, 1000, "desktop", false],
    [390, 844, "phone", true]
  ] as const) {
    const ctx = await browser.newContext({
      viewport: { width: vw, height: vh },
      deviceScaleFactor: mobile ? 2 : 1,
      isMobile: mobile,
      hasTouch: mobile
    });
    for (const [name, url, authed] of shots) {
      await ctx.clearCookies();
      if (authed) {
        const [k, v] = ca.split("=");
        await ctx.addCookies([{ name: k, value: v, url: base }]);
      }
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && !/404|Failed to load resource/.test(m.text()) && errors.push(m.text()));
      await page.goto(base + url, { waitUntil: "networkidle" });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(outDir, `${label}-${name}.png`), fullPage: !mobile });
      if (errors.length) console.log(`  ${label}/${name} errors:`, errors.slice(0, 3));
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
}

async function cleanup() {
  const r = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
  let n = 0;
  for (const u of [A, B].map((s) => s.toLowerCase())) {
    let cursor = "0";
    do {
      const [next, keys] = await r.scan(cursor, { match: `*${u}*`, count: 500 });
      cursor = String(next);
      if (keys.length) n += await r.del(...keys);
    } while (cursor !== "0");
    await r.zrem("e2:lb", u);
  }
  console.log(`cleanup: deleted ${n} keys`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(cleanup);
