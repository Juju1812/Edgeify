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
