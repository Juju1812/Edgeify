import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { isValidUsername, requireUser } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { block, fileReport, REPORT_REASONS, type ReportReason } from "@/lib/server/safety";
import { redis, K } from "@/lib/server/redis";
import { cancelForReport, isPlayer, loadMatch } from "@/lib/server/matches";

export const dynamic = "force-dynamic";

/** POST /api/report { username, reason, note?, matchId?, alsoBlock? } */
export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  const body = await readJson<{ username?: string; reason?: string; note?: unknown; matchId?: unknown; alsoBlock?: unknown }>(req);
  if (!isValidUsername(body.username)) throw new HttpError(400, "bad_user", "Unknown player.");
  const target = await redis().hget<string>(K.user(body.username), "username");
  if (!target) throw new HttpError(404, "no_user", "That player doesn't exist.");
  if (target.toLowerCase() === me.toLowerCase()) throw new HttpError(400, "self", "You can't report yourself.");
  if (!REPORT_REASONS.includes(body.reason as ReportReason)) throw new HttpError(400, "bad_reason", "Pick a reason.");

  await rateLimit("report", me, 20, 86400, "You've sent a lot of reports today.");
  const matchId = typeof body.matchId === "string" && /^[0-9a-f]{20}$/.test(body.matchId) ? body.matchId : null;
  await fileReport({
    target,
    by: me,
    reason: body.reason as ReportReason,
    note: typeof body.note === "string" ? body.note.slice(0, 500) : "",
    matchId,
    at: Date.now()
  });
  if (body.alsoBlock === true) await block(me, target);

  // Reporting during a live match ends it with no ELO change — capped so it
  // can't be used to dodge losses.
  let matchCancelled = false;
  if (matchId) {
    try {
      const m = await loadMatch(matchId);
      if (isPlayer(m, me) && isPlayer(m, target) && (m.state === "connecting" || m.state === "live")) {
        await rateLimit("reportcancel", me, 3, 86400, "Report sent. You can't end more matches by reporting today — use Leave.");
        await cancelForReport(matchId, me);
        matchCancelled = true;
      }
    } catch (e) {
      if (e instanceof HttpError && e.code === "rate_limited") return json({ ok: true, matchCancelled, note: e.message });
    }
  }
  return json({ ok: true, matchCancelled });
});
