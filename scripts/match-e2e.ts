/**
 * Live two-browser ranked match through the real UI.
 *   npx tsx scripts/match-e2e.ts http://localhost:3100 <outDir> faceA.mjpeg faceB.mjpeg faceA.jpg faceB.jpg
 * Each player is a separate Edge instance whose fake webcam plays a face
 * (MJPEG). Verifies pairing → WebRTC video → countdown → AI scores → result.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { Redis } from "@upstash/redis";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const [base, outDir, camA, camB, jpgA, jpgB] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const tag = Math.random().toString(36).slice(2, 6);
const users = [`Ava_${tag}`, `Leo_${tag}`];

async function signupAndScan(u: string, jpg: string) {
  const s = await fetch(base + "/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: "testpass123", isOver18: true })
  });
  const cookie = s.headers.get("set-cookie")!.split(";")[0];
  const img = `data:image/jpeg;base64,${fs.readFileSync(jpg).toString("base64")}`;
  const r = await fetch(base + "/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ frames: [img], thumb: img })
  });
  console.log(`${u} scan`, r.status);
  return cookie;
}

async function player(u: string, cookie: string, cam: string) {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${cam}`,
      "--autoplay-policy=no-user-gesture-required"
    ]
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ["camera", "microphone"] });
  const [k, v] = cookie.split("=");
  await ctx.addCookies([{ name: k, value: v, url: base }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [${u}] pageerror:`, e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) console.log(`  [${u}] console:`, m.text());
  });
  return { browser, page };
}

async function waitText(page: Page, re: RegExp, ms: number) {
  await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), re.source, { timeout: ms });
}

async function main() {
  const cookies = await Promise.all([signupAndScan(users[0], jpgA), signupAndScan(users[1], jpgB)]);
  const [pa, pb] = await Promise.all([player(users[0], cookies[0], camA), player(users[1], cookies[1], camB)]);

  await Promise.all([pa.page.goto(base + "/play?search=1"), pb.page.goto(base + "/play?search=1")]);
  await Promise.all([
    pa.page.waitForURL(/\/play\/match\//, { timeout: 30_000 }),
    pb.page.waitForURL(/\/play\/match\//, { timeout: 30_000 })
  ]);
  console.log("✓ paired:", pa.page.url().split("/").pop());

  // Wait for remote video to actually play in both tabs.
  const videoUp = (page: Page) =>
    page.waitForFunction(
      () => [...document.querySelectorAll("video")].filter((v) => v.readyState >= 2 && v.videoWidth > 0).length >= 2,
      undefined,
      { timeout: 25_000 }
    );
  const rtc = await Promise.allSettled([videoUp(pa.page), videoUp(pb.page)]);
  console.log(rtc.every((r) => r.status === "fulfilled") ? "✓ WebRTC video flowing both ways" : "✗ remote video did not connect");
  await pa.page.waitForTimeout(1500);
  await pa.page.screenshot({ path: path.join(outDir, "match-live-a.png") });

  await Promise.all([waitText(pa.page, /You win|wins|draw/i, 90_000), waitText(pb.page, /You win|wins|draw/i, 90_000)]);
  await pa.page.waitForTimeout(1600);
  await pa.page.screenshot({ path: path.join(outDir, "match-result-a.png"), fullPage: true });
  await pb.page.screenshot({ path: path.join(outDir, "match-result-b.png"), fullPage: true });
  const ta = await pa.page.evaluate(() => document.body.innerText.match(/You win|[\w-]+ wins|It's a draw/)?.[0]);
  const tb = await pb.page.evaluate(() => document.body.innerText.match(/You win|[\w-]+ wins|It's a draw/)?.[0]);
  console.log(`✓ result — ${users[0]} sees "${ta}", ${users[1]} sees "${tb}"`);

  await pa.browser.close();
  await pb.browser.close();
}

async function cleanup() {
  const r = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
  let n = 0;
  for (const u of users.map((s) => s.toLowerCase())) {
    let cursor = "0";
    do {
      const [next, keys] = await r.scan(cursor, { match: `*${u}*`, count: 500 });
      cursor = String(next);
      if (keys.length) n += await r.del(...keys);
    } while (cursor !== "0");
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
