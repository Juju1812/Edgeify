"use client";

import Link from "next/link";
import { useState } from "react";
import { Footer } from "@/components/Footer";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/lib/toast-context";
import { COUNTRIES } from "@/lib/countries";
import { setSoundVolume } from "@/lib/audio";
import type { ArColorId } from "@/lib/types";
import { AR_FILTERS } from "@/lib/ar-filters";
import { FREE_AR_FILTERS, isPro } from "@/lib/pro";
import { VoiceNoteRecorder } from "@/components/VoiceNoteRecorder";
import { EmoteLoadoutPicker } from "@/components/EmoteLoadoutPicker";
import { ReferralLink } from "@/components/ReferralLink";

const AR_COLORS: { id: ArColorId; label: string; hex: string }[] = [
  { id: "green", label: "Lime", hex: "#4ade80" },
  { id: "cyan", label: "Cyan", hex: "#22d3ee" },
  { id: "pink", label: "Magenta", hex: "#d946ef" },
  { id: "gold", label: "Gold", hex: "#fde047" },
  { id: "violet", label: "Violet", hex: "#a855f7" }
];

const EMOJI_PALETTE = [
  "🔥","💀","👑","😂","🗿","🤡","💎","💪","🍂","💧","⚖️","🚀",
  "👀","🧠","🎯","🏆","⚡","🛡️","💥","🎉","💯","🥶","🤯","🤝"
];

export default function SettingsPage() {
  const { user, status, update, signOut } = useUser();
  const { toast } = useToast();
  const [bio, setBio] = useState(user.bio);

  if (status === "guest") {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 pt-10">
        <p className="text-sm text-white/40">Sign in to access settings.</p>
      </main>
    );
  }

  function setEmoji(idx: number, emoji: string) {
    update((prev) => {
      const next = [...prev.customEmojis];
      next[idx] = emoji;
      return { customEmojis: next };
    });
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link href="/" className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white">
        ← Back to Lobby
      </Link>
      <div className="mt-6">
        <p className="label-xs">Settings</p>
        <h1 className="heading-card mt-2 text-3xl">Preferences</h1>
      </div>

      {/* Profile */}
      <Section title="Profile">
        <Field label="Bio (140 chars)">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 140))}
            onBlur={() => {
              if (bio !== user.bio) {
                update({ bio });
                toast("Bio saved", { kind: "success", emoji: "✓", ttl: 1500 });
              }
            }}
            placeholder="A short bio shown on your public profile."
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-mog-violet"
          />
          <p className="mt-1 text-right text-[10px] uppercase tracking-[0.22em] text-white/30">
            {bio.length}/140
          </p>
        </Field>

        <Field label="Country">
          <select
            value={user.countryCode || ""}
            onChange={(e) => update({ countryCode: e.target.value || null })}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-mog-violet"
          >
            <option value="">— None —</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* Theme & visuals */}
      <Section title="Visuals">
        <Field label="AR Mesh Color">
          <div className="flex flex-wrap gap-2">
            {AR_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => update({ arColor: c.id })}
                className={
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] transition " +
                  (user.arColor === c.id
                    ? "border-white/40 bg-white/10 text-white"
                    : "border-white/10 bg-white/[0.02] text-white/60")
                }
                style={{ color: user.arColor === c.id ? c.hex : undefined }}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{
                    background: c.hex,
                    boxShadow: `0 0 8px ${c.hex}`
                  }}
                />
                {c.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="AR Filter">
          <div className="flex flex-wrap gap-2">
            {AR_FILTERS.map((f) => {
              const free = (FREE_AR_FILTERS as readonly string[]).includes(f.id);
              const locked = !free && !isPro(user);
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    if (locked) {
                      toast("Pro filter — upgrade to unlock.", { kind: "warn" });
                      return;
                    }
                    update({ arFilter: f.id });
                  }}
                  className={
                    "relative flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] transition " +
                    (locked
                      ? "border-white/[0.06] bg-white/[0.01] text-white/35"
                      : (user.arFilter || "none") === f.id
                        ? "border-edge-cyan/60 bg-edge-cyan/10 text-edge-cyan"
                        : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20")
                  }
                >
                  <span className="text-base">{f.emoji}</span>
                  {f.label}
                  {locked && (
                    <span className="ml-1 rounded-full bg-edge-coral/30 px-1 py-0.5 text-[7px] font-bold tracking-[0.18em] text-edge-coral">
                      PRO
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/30">
            Cosmetic — drawn over your face during matches.{" "}
            {!isPro(user) && (
              <Link href="/pricing" className="text-edge-coral hover:underline">
                Unlock all
              </Link>
            )}
          </p>
        </Field>
      </Section>

      {/* Reactions */}
      <Section title="Quick Reactions">
        <p className="mb-2 text-xs text-white/50">
          Pick 6 emojis that show below your tile in live matches.
        </p>
        <div className="grid grid-cols-6 gap-2">
          {user.customEmojis.map((e, i) => (
            <details key={i} className="relative">
              <summary className="flex h-12 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/30 text-2xl">
                {e}
              </summary>
              <div className="absolute left-0 top-14 z-20 grid w-64 grid-cols-6 gap-1 rounded-xl border border-white/10 bg-black/90 p-2">
                {EMOJI_PALETTE.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setEmoji(i, opt)}
                    className="flex h-9 w-9 items-center justify-center rounded text-xl hover:bg-white/10"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </details>
          ))}
        </div>
      </Section>

      {/* Walkout audio */}
      <Section title="Walkout audio">
        <p className="text-xs leading-relaxed text-white/55">
          Upload a short audio clip (≤ 1MB, ideally 3–5 seconds). It plays
          locally for you when a match starts. We don&apos;t broadcast it
          to your opponent, and it&apos;s saved on this device only.
        </p>
        <WalkoutPicker />
      </Section>

      {/* Custom rank icon (Pro) */}
      <Section title="Custom rank icon">
        <p className="text-xs leading-relaxed text-white/55">
          Replaces the default rank emoji on your profile, leaderboard
          row, and match cards. Pro feature.
        </p>
        {(() => {
          const pro = isPro(user);
          const RANK_ICONS = [
            "🦁","🐯","🐺","🦅","🐉","👹","🦈","🐍",
            "👻","💀","🤖","👑","💎","⚡","🔥","🌟",
            "🎭","🃏","🎯","🎮","🕷️","🌑","🩸","⚔️"
          ];
          if (!pro) {
            return (
              <p className="rounded-lg border border-edge-coral/30 bg-edge-coral/[0.06] p-3 text-[11px] uppercase tracking-[0.22em] text-edge-coral">
                <Link href="/pricing" className="hover:underline">
                  Unlock with Edgify Pro →
                </Link>
              </p>
            );
          }
          return (
            <div className="grid grid-cols-8 gap-2 sm:grid-cols-12">
              <button
                onClick={() => update({ customRankIcon: null })}
                className={
                  "flex h-10 items-center justify-center rounded-lg border text-[10px] uppercase tracking-[0.18em] transition " +
                  (user.customRankIcon === null
                    ? "border-edge-cyan/60 bg-edge-cyan/[0.08] text-edge-cyan"
                    : "border-white/10 bg-white/[0.02] text-white/55 hover:border-white/20")
                }
                title="Use default rank emoji"
              >
                Default
              </button>
              {RANK_ICONS.map((e) => (
                <button
                  key={e}
                  onClick={() => update({ customRankIcon: e })}
                  className={
                    "flex h-10 items-center justify-center rounded-lg border text-2xl transition " +
                    (user.customRankIcon === e
                      ? "border-edge-cyan/60 bg-edge-cyan/[0.08]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20")
                  }
                >
                  {e}
                </button>
              ))}
            </div>
          );
        })()}
      </Section>

      {/* Audio + camera */}
      <Section title="Audio & Camera">
        <Field label={`Sound volume: ${Math.round(user.soundVolume * 100)}%`}>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(user.soundVolume * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              update({ soundVolume: v });
              setSoundVolume(v);
            }}
            className="w-full accent-mog-violet"
          />
        </Field>
        <Toggle
          label="Mic on by default in live matches"
          value={user.micDefault}
          onChange={(v) => update({ micDefault: v })}
        />
        <Toggle
          label="Privacy filter (blurs your video)"
          value={user.privacyBlur}
          onChange={(v) => update({ privacyBlur: v })}
        />
      </Section>

      {/* Voice note */}
      <Section title="Voice note">
        <VoiceNoteRecorder />
      </Section>

      {/* Emote loadouts */}
      <Section title="Emote loadout">
        <EmoteLoadoutPicker />
      </Section>

      {/* Profile customization */}
      <Section title="Profile">
        <Field label="Accent color">
          <div className="flex flex-wrap gap-2">
            {[
              "#22e9ff",
              "#ff5d8f",
              "#fde047",
              "#a855f7",
              "#34d399",
              "#f97316",
              "#ec4899",
              "#94a3b8"
            ].map((c) => (
              <button
                key={c}
                onClick={() => update({ accentColor: c })}
                className={
                  "h-9 w-9 rounded-full border-2 transition " +
                  (user.accentColor === c
                    ? "border-white scale-110"
                    : "border-white/15")
                }
                style={{ background: c, boxShadow: `0 0 12px ${c}55` }}
                title={c}
              />
            ))}
          </div>
        </Field>
        <Field label="Banner gradient">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              "linear-gradient(135deg, #22e9ff20, #ff5d8f15)",
              "linear-gradient(135deg, #fde04720, #f9731620)",
              "linear-gradient(135deg, #a855f720, #ec489920)",
              "linear-gradient(135deg, #34d39920, #22e9ff20)",
              "linear-gradient(135deg, #ff5d8f20, #fde04720)",
              "linear-gradient(180deg, #04060c, #0b1124)"
            ].map((g) => (
              <button
                key={g}
                onClick={() => update({ bannerGradient: g })}
                className={
                  "h-12 rounded-lg border transition " +
                  (user.bannerGradient === g
                    ? "border-edge-cyan/60"
                    : "border-white/10 hover:border-white/30")
                }
                style={{ background: g }}
              />
            ))}
          </div>
        </Field>

        {/* Theme builder (Pro): full hex color picker + custom gradient stops. */}
        <ProThemeBuilder />
      </Section>

      {/* Referral link */}
      <Section title="Invite friends">
        <ReferralLink />
      </Section>

      {/* Tutorial replay */}
      <Section title="Tutorial">
        <p className="text-xs leading-relaxed text-white/55">
          Re-run the introductory walkthrough. Useful if you want to
          show a friend, or just refresh on the basics.
        </p>
        <button
          onClick={() => {
            update({ tutorialCompleted: false });
            toast("Tutorial reset — head back to the lobby to view.", {
              kind: "success"
            });
          }}
          className="rounded-lg border border-edge-cyan/40 bg-edge-cyan/[0.08] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan/70 hover:bg-edge-cyan/[0.16]"
        >
          Replay tutorial
        </button>
      </Section>

      {/* Performance */}
      <Section title="Performance">
        <p className="text-xs leading-relaxed text-white/55">
          Disables backdrop blur, glow shadows, and ambient animations
          for snappier rendering on slower devices. Layout and colors
          are preserved.
        </p>
        <div className="flex flex-wrap gap-2">
          {(["auto", "on", "off"] as const).map((v) => {
            const active = (user.lowPerfPref || "auto") === v;
            const label =
              v === "auto"
                ? "Auto (detect)"
                : v === "on"
                  ? "Light mode"
                  : "Full effects";
            return (
              <button
                key={v}
                onClick={() => update({ lowPerfPref: v })}
                className={
                  "rounded-lg border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] transition " +
                  (active
                    ? "border-edge-cyan/60 bg-edge-cyan/15 text-white"
                    : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white")
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Accessibility */}
      <Section title="Accessibility">
        <Toggle
          label="Reduced motion (kill animations + transitions)"
          value={!!user.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
        />
        <Toggle
          label="Larger text"
          value={!!user.largerText}
          onChange={(v) => update({ largerText: v })}
        />
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <Toggle
          label="Browser push notifications"
          value={user.pushEnabled}
          onChange={async (v) => {
            if (v && typeof Notification !== "undefined") {
              try {
                const perm = await Notification.requestPermission();
                if (perm !== "granted") {
                  toast("Notifications blocked by browser", { kind: "warn" });
                  return;
                }
              } catch {
                /* */
              }
            }
            update({ pushEnabled: v });
          }}
        />
      </Section>

      {/* Account */}
      <Section title="Account">
        <Field label="Email (for password reset)">
          <input
            type="email"
            value={user.email || ""}
            onChange={(e) => update({ email: e.target.value || null })}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-mog-violet"
          />
        </Field>
        <button
          onClick={() => {
            signOut();
            toast("Signed out", { kind: "info", emoji: "👋" });
          }}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-5 py-2 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
        >
          Sign out
        </button>
      </Section>

      <Footer />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="label-xs mb-3">{title}</h2>
      <div className="glass space-y-4 rounded-2xl p-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-xs mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span className="text-white/70">{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-mog-violet"
      />
    </label>
  );
}

function WalkoutPicker() {
  const { user, update } = useUser();
  const { toast } = useToast();
  const inputId = "walkout-upload-input";

  function onFile(file: File) {
    if (file.size > 1_000_000) {
      toast("File too big. Max 1MB.", { kind: "error" });
      return;
    }
    if (!file.type.startsWith("audio/")) {
      toast("Pick an audio file (mp3, m4a, wav, ogg).", { kind: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      update({ walkoutAudio: dataUrl });
      toast("Walkout saved — plays locally on match start.", {
        kind: "success"
      });
    };
    reader.onerror = () => toast("Couldn't read the file.", { kind: "error" });
    reader.readAsDataURL(file);
  }

  function preview() {
    if (!user.walkoutAudio) return;
    const a = new Audio(user.walkoutAudio);
    a.volume = user.soundVolume;
    a.play().catch(() => {});
    window.setTimeout(() => a.pause(), 5000);
  }

  return (
    <div className="space-y-3">
      <input
        id={inputId}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-lg border border-edge-cyan/40 bg-edge-cyan/[0.08] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan/70 hover:bg-edge-cyan/[0.16]"
        >
          {user.walkoutAudio ? "Replace clip" : "Upload clip"}
        </label>
        {user.walkoutAudio && (
          <>
            <button
              onClick={preview}
              className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65 transition hover:border-white/20 hover:text-white"
            >
              Preview (5s)
            </button>
            <button
              onClick={() => {
                update({ walkoutAudio: null });
                toast("Walkout removed.", { kind: "info" });
              }}
              className="rounded-lg border border-rose-500/30 bg-rose-500/[0.04] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-300 transition hover:border-rose-500/60 hover:bg-rose-500/[0.08]"
            >
              Remove
            </button>
          </>
        )}
      </div>
      {user.walkoutAudio && (
        <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-300">
          ✓ Clip armed
        </p>
      )}
    </div>
  );
}

function ProThemeBuilder() {
  const { user, update } = useUser();
  const pro = isPro(user);

  // Best-effort parse of the existing gradient so the stop pickers
  // initialize from the user's current banner. Falls back to brand
  // defaults if the string isn't a recognizable two-stop linear-gradient.
  const stops = (() => {
    const m = user.bannerGradient.match(/#([0-9a-f]{6,8})/gi);
    return {
      a: m?.[0] ? "#" + m[0].replace("#", "").slice(0, 6) : "#22e9ff",
      b: m?.[1] ? "#" + m[1].replace("#", "").slice(0, 6) : "#ff5d8f"
    };
  })();

  if (!pro) {
    return (
      <div className="rounded-lg border border-edge-coral/30 bg-edge-coral/[0.06] p-3 text-[11px] uppercase tracking-[0.22em] text-edge-coral">
        <Link href="/pricing" className="hover:underline">
          Edgify Pro · custom hex colors + gradient builder →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-edge-cyan/25 bg-edge-cyan/[0.04] p-4">
      <p className="label-xs text-edge-cyan">Pro · custom theme</p>
      <Field label="Accent (full hex)">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={user.accentColor}
            onChange={(e) => update({ accentColor: e.target.value })}
            className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
          />
          <code className="rounded bg-black/40 px-2 py-1 text-xs text-white/80">
            {user.accentColor}
          </code>
        </div>
      </Field>
      <Field label="Banner gradient stops">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={stops.a}
            onChange={(e) =>
              update({
                bannerGradient: `linear-gradient(135deg, ${e.target.value}30, ${stops.b}25)`
              })
            }
            className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
          />
          <span className="text-white/35">→</span>
          <input
            type="color"
            value={stops.b}
            onChange={(e) =>
              update({
                bannerGradient: `linear-gradient(135deg, ${stops.a}30, ${e.target.value}25)`
              })
            }
            className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
          />
          <div
            className="h-9 flex-1 rounded-md border border-white/10"
            style={{ background: user.bannerGradient }}
          />
        </div>
      </Field>
    </div>
  );
}
