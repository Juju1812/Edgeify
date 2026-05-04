"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Footer } from "@/components/Footer";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/lib/toast-context";
import { isPro } from "@/lib/pro";

const FEATURES: Array<{
  feature: string;
  free: string | true;
  pro: string | true;
}> = [
  { feature: "Live 1v1 ranked matches", free: true, pro: true },
  { feature: "Face scan + EdgeScore", free: true, pro: true },
  { feature: "Leaderboard + season pass", free: true, pro: true },
  { feature: "Achievements + replays", free: true, pro: true },
  { feature: "Highlight clip generator", free: true, pro: true },
  { feature: "AI Deep Analysis", free: "3/month", pro: "Unlimited" },
  { feature: "AR cosmetic filters", free: true, pro: true },
  { feature: "Emote loadouts", free: "2 prebuilt", pro: "All + custom saves" },
  { feature: "Profile accent color", free: "8 presets", pro: "Full hex picker" },
  { feature: "Priority matchmaking", free: "—", pro: "Skip ahead in queue" },
  { feature: "Pro badge on profile", free: "—", pro: "Gold gradient mark" }
];

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10">
          <div className="glass h-64 animate-pulse rounded-2xl" />
        </main>
      }
    >
      <PricingInner />
    </Suspense>
  );
}

function PricingInner() {
  const { user, status, authedRemote } = useUser();
  const { toast } = useToast();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const pro = isPro(user);

  useEffect(() => {
    if (params.get("ok") === "1") {
      toast("Payment successful — Pro unlocked", {
        kind: "success",
        emoji: "✨",
        ttl: 6000
      });
    }
    if (params.get("cancelled") === "1") {
      toast("Checkout cancelled", { kind: "info" });
    }
  }, [params, toast]);

  async function startCheckout() {
    if (busy) return;
    if (!authedRemote) {
      toast("Sign in to subscribe.", { kind: "warn" });
      return;
    }
    setBusy(true);
    try {
      const token = localStorage.getItem("edgify:auth:token:v1");
      if (!token) return;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan: "monthly" })
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast(data.message || data.error || "Checkout failed.", { kind: "error" });
        return;
      }
      window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    if (busy) return;
    setBusy(true);
    try {
      const token = localStorage.getItem("edgify:auth:token:v1");
      if (!token) return;
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast(data.message || data.error || "Couldn't open portal.", { kind: "error" });
        return;
      }
      window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6 text-center">
        <p className="label-xs text-edge-cyan">Pricing</p>
        <h1 className="heading-display mt-2 text-5xl">
          Get the <span className="brand-edge">edge</span>.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-white/55">
          Edgify Pro unlocks unlimited AI Deep Analysis, every AR filter,
          custom accents, and a Pro badge on your profile. One simple price.
        </p>
      </div>

      {/* Plan card */}
      <div className="mx-auto mt-10 max-w-md">
        <div className="glass-featured relative overflow-hidden rounded-3xl p-7">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="label-xs text-edge-coral">Edgify Pro</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-white/40">
                Monthly · cancel anytime
              </p>
            </div>
            {pro && (
              <span className="rounded-full bg-edge-cyan/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-edge-cyan">
                Active
              </span>
            )}
          </div>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="stat-mono text-6xl font-bold text-white">$4.99</span>
            <span className="text-sm text-white/45">/ month</span>
          </div>
          {pro ? (
            <>
              <p className="mt-4 text-xs text-white/55">
                You&apos;re Pro until{" "}
                <span className="font-semibold text-white">
                  {user.proUntil
                    ? new Date(user.proUntil).toLocaleDateString()
                    : "—"}
                </span>
                .
              </p>
              <button
                onClick={openPortal}
                disabled={busy}
                className="mt-5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] disabled:opacity-50"
              >
                {busy ? "Loading…" : "Manage subscription"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startCheckout}
                disabled={busy || status === "guest"}
                className="mt-5 w-full rounded-xl border border-edge-cyan/60 bg-edge-cyan/15 px-5 py-3.5 text-sm font-bold uppercase tracking-[0.22em] text-white shadow-glow transition hover:border-edge-cyan hover:bg-edge-cyan/25 disabled:opacity-50"
              >
                {busy
                  ? "Redirecting…"
                  : status === "guest"
                    ? "Sign in to subscribe"
                    : "Subscribe →"}
              </button>
              <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-white/35">
                Secure checkout via Stripe · cancel any time
              </p>
            </>
          )}
        </div>
      </div>

      {/* Comparison table */}
      <div className="mt-10 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015]">
        <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-white/[0.06] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.22em]">
          <span className="text-white/45">Feature</span>
          <span className="text-center text-white/55">Free</span>
          <span className="text-center text-edge-cyan">Pro</span>
        </div>
        {FEATURES.map((f) => (
          <div
            key={f.feature}
            className="grid grid-cols-[2fr_1fr_1fr] border-b border-white/[0.04] px-5 py-3 text-xs last:border-b-0"
          >
            <span className="text-white/85">{f.feature}</span>
            <span className="text-center text-white/55">
              {f.free === true ? "✓" : f.free}
            </span>
            <span className="text-center font-semibold text-edge-cyan">
              {f.pro === true ? "✓" : f.pro}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-[10px] uppercase tracking-[0.32em] text-white/30">
        Cancel anytime · prorated refunds · payment via Stripe
      </p>

      <Footer />
    </main>
  );
}
