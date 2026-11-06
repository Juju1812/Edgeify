/**
 * Dev harness: score local face images with the new AI scorer.
 *   npx tsx scripts/score-test.ts path/to/a.jpg [path/to/b.jpg ...]
 * All images passed are treated as frames of the SAME person.
 * Reads ANTHROPIC_API_KEY from .env.local. Each run costs a few cents.
 */
import fs from "node:fs";
import path from "node:path";
import { scoreFace, type Frame } from "../src/lib/scoring/ai-score";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: npx tsx scripts/score-test.ts <image> [image...]");
  process.exit(1);
}

const frames: Frame[] = files.map((f) => {
  const ext = path.extname(f).toLowerCase();
  const mediaType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { mediaType, data: fs.readFileSync(f).toString("base64") };
});

const t0 = Date.now();
scoreFace(frames).then((r) => {
  console.log(JSON.stringify(r, null, 2));
  console.log(`took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
});
