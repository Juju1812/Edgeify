"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/user-context";
import { Footer } from "@/components/Footer";

type Report = {
  id: string;
  reporter: string;
  target: string;
  reason: string;
  note?: string;
  ts: number;
  status: "open" | "actioned" | "dismissed";
};

const ADMIN_USERNAMES = ["jrubski"];

export default function ReportsAdminPage() {
  const { user, ready } = useUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin =
    !!user.username && ADMIN_USERNAMES.includes(user.username.toLowerCase());

  useEffect(() => {
    if (!ready || !isAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const token = localStorage.getItem("edgify:auth:token:v1");
      if (!token) {
        setError("Sign in required.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/report", {
          headers: { authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.message || data.error || "Failed to load.");
        } else {
          setReports(data.reports || []);
        }
      } catch {
        if (!cancelled) setError("Network error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, isAdmin]);

  async function setStatus(id: string, status: "actioned" | "dismissed") {
    const token = localStorage.getItem("edgify:auth:token:v1");
    if (!token) return;
    const res = await fetch("/api/report", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ id, status })
    });
    if (res.ok) {
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    }
  }

  if (!ready) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10">
        <div className="glass h-32 animate-pulse rounded-2xl" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 text-center">
        <Link
          href="/"
          className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
        >
          ← Back to Lobby
        </Link>
        <div className="glass mt-10 rounded-2xl px-6 py-12">
          <p className="text-sm text-white/65">
            This page is for moderators only.
          </p>
        </div>
      </main>
    );
  }

  const open = reports.filter((r) => r.status === "open");
  const closed = reports.filter((r) => r.status !== "open");

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>
      <div className="mt-6">
        <p className="label-xs text-edge-coral">Moderation</p>
        <h1 className="heading-display mt-2 text-3xl">
          Reports queue
          <span className="ml-3 text-base text-white/45">
            {open.length} open
          </span>
        </h1>
      </div>

      {loading && (
        <div className="glass mt-6 h-24 animate-pulse rounded-2xl" />
      )}
      {error && (
        <div className="glass mt-6 rounded-2xl p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      <h2 className="label-xs mt-8">Open</h2>
      {!loading && open.length === 0 && (
        <p className="mt-3 text-sm text-white/45">No open reports.</p>
      )}
      <div className="mt-3 space-y-3">
        {open.map((r) => (
          <ReportRow key={r.id} r={r} onAction={setStatus} />
        ))}
      </div>

      {closed.length > 0 && (
        <>
          <h2 className="label-xs mt-10">Recently closed</h2>
          <div className="mt-3 space-y-2 opacity-60">
            {closed.slice(0, 30).map((r) => (
              <ReportRow key={r.id} r={r} compact />
            ))}
          </div>
        </>
      )}

      <Footer />
    </main>
  );
}

function ReportRow({
  r,
  onAction,
  compact
}: {
  r: Report;
  onAction?: (id: string, status: "actioned" | "dismissed") => void;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-xl border border-white/[0.04] bg-white/[0.01] p-3"
          : "glass rounded-xl p-4"
      }
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <Link
          href={`/u/${encodeURIComponent(r.target)}`}
          className="text-sm font-bold uppercase tracking-[0.18em] text-white"
        >
          @{r.target}
        </Link>
        <span className="rounded-full border border-edge-coral/40 bg-edge-coral/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-edge-coral">
          {r.reason}
        </span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
          by @{r.reporter} · {new Date(r.ts).toLocaleString()}
        </span>
        {r.status !== "open" && (
          <span
            className={
              "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] " +
              (r.status === "actioned"
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-white/[0.06] text-white/45")
            }
          >
            {r.status}
          </span>
        )}
      </div>
      {r.note && (
        <p className="mt-2 text-xs leading-relaxed text-white/65">{r.note}</p>
      )}
      {onAction && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onAction(r.id, "actioned")}
            className="rounded-md border border-emerald-400/40 bg-emerald-500/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300 transition hover:border-emerald-400/70 hover:bg-emerald-500/15"
          >
            Mark actioned
          </button>
          <button
            onClick={() => onAction(r.id, "dismissed")}
            className="rounded-md border border-white/15 bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55 transition hover:border-white/30 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
