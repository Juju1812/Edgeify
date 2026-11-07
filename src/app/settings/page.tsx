"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { useRequireAuth } from "@/lib/client/use-require-auth";
import { DEFAULT_OVERLAY_COLOR, type MeProfile } from "@/lib/shared/types";
import { Avatar, Button, ButtonLink, Card, Input, Notice, PageTitle, Spinner } from "@/components/ui";
import { RecoveryCodeCard } from "@/components/recovery-code";

const COUNTRIES: [string, string][] = [
  ["", "Not shown"], ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["AU", "Australia"],
  ["NZ", "New Zealand"], ["IE", "Ireland"], ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"],
  ["NL", "Netherlands"], ["BE", "Belgium"], ["SE", "Sweden"], ["NO", "Norway"], ["DK", "Denmark"], ["FI", "Finland"],
  ["PL", "Poland"], ["PT", "Portugal"], ["CH", "Switzerland"], ["AT", "Austria"], ["BR", "Brazil"], ["MX", "Mexico"],
  ["AR", "Argentina"], ["CO", "Colombia"], ["IN", "India"], ["PK", "Pakistan"], ["PH", "Philippines"], ["ID", "Indonesia"],
  ["JP", "Japan"], ["KR", "South Korea"], ["CN", "China"], ["SG", "Singapore"], ["MY", "Malaysia"], ["TR", "Türkiye"],
  ["AE", "United Arab Emirates"], ["SA", "Saudi Arabia"], ["EG", "Egypt"], ["NG", "Nigeria"], ["ZA", "South Africa"],
  ["KE", "Kenya"], ["MA", "Morocco"], ["IL", "Israel"], ["RU", "Russia"], ["UA", "Ukraine"]
];

export default function SettingsPage() {
  const { me, setMe, signOut, faceVersion } = useRequireAuth();
  const router = useRouter();
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [showOnBoard, setShowOnBoard] = useState(true);
  const [overlayColor, setOverlayColor] = useState(DEFAULT_OVERLAY_COLOR);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!me) return;
    setBio(me.bio);
    setCountry(me.country);
    setShowOnBoard(me.showOnBoard);
    setOverlayColor(me.overlayColor || DEFAULT_OVERLAY_COLOR);
  }, [me]);

  if (!me) {
    return (
      <main className="page flex justify-center pt-24">
        <Spinner />
      </main>
    );
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await api<{ me: MeProfile }>("/api/me", { method: "PATCH", body: { bio, country, showOnBoard, overlayColor } });
      setMe(r.me);
      setMsg({ tone: "good", text: "Saved." });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiError ? e.message : "Couldn't save. Try again." });
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    bio !== me.bio ||
    country !== me.country ||
    showOnBoard !== me.showOnBoard ||
    overlayColor !== (me.overlayColor || DEFAULT_OVERLAY_COLOR);

  return (
    <main className="page">
      <div className="mx-auto max-w-[640px]">
        <PageTitle title="Profile" />

        <Card className="flex items-center gap-5 p-6">
          <Avatar username={me.username} hasFace={me.hasFace} size={72} version={faceVersion} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[22px] font-semibold tracking-tight">{me.username}</p>
            <p className="text-[15px] text-ink-3">
              {me.score ? `Score ${me.score.overall}` : "Not scanned yet"} · {me.elo} ELO · {me.wins}–{me.losses}
            </p>
          </div>
          <ButtonLink href={`/u/${me.username}`} variant="plain" size="sm">
            View
          </ButtonLink>
        </Card>
        <p className="mt-2 px-2 text-[13px] text-ink-4">Your photo updates every time you scan.</p>

        <Card className="mt-5 flex flex-col gap-5 p-6">
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-medium">Bio</span>
            <Input value={bio} onChange={(e) => setBio(e.target.value)} maxLength={140} placeholder="A line about you" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-medium">Country</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="h-12 w-full appearance-none rounded-2xl border border-line bg-white px-4 text-[16px] focus:border-accent focus:shadow-ring focus:outline-none"
            >
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-[15px] font-medium">Show me on the leaderboard</span>
              <span className="block text-[13px] text-ink-3">Your photo and stats appear publicly once you&apos;re ranked.</span>
            </span>
            <Toggle on={showOnBoard} onChange={setShowOnBoard} />
          </label>
          <ColorSetting value={overlayColor} onChange={setOverlayColor} />
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <div className="flex justify-end">
            <Button onClick={save} loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </Card>

        <RecoverySection username={me.username} />
        <BlockedSection />

        <Card className="mt-5 p-2">
          <Link href="/scan" className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-[16px] hover:bg-fill">
            Rescan your face <Chevron />
          </Link>
          <button
            onClick={async () => {
              await signOut();
              router.replace("/");
            }}
            className="flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[16px] text-bad hover:bg-fill"
          >
            Sign out
          </button>
        </Card>
      </div>
    </main>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${on ? "bg-[#34c759]" : "bg-fill-2"}`}
    >
      <span
        className={`absolute left-0 top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${on ? "translate-x-[22px]" : "translate-x-[2px]"}`}
      />
    </button>
  );
}

const SWATCHES: [string, string][] = [
  ["#ffffff", "White"],
  ["#0a84ff", "Blue"],
  ["#64d2ff", "Cyan"],
  ["#30d158", "Green"],
  ["#ffd60a", "Yellow"],
  ["#ff9f0a", "Orange"],
  ["#ff375f", "Pink"],
  ["#bf5af2", "Purple"]
];

function ColorSetting({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const custom = !SWATCHES.some(([c]) => c === value.toLowerCase());
  return (
    <div className="flex flex-col gap-3">
      <span>
        <span className="block text-[15px] font-medium">Scan overlay colour</span>
        <span className="block text-[13px] text-ink-3">The dots and score callouts drawn on your face when you scan.</span>
      </span>
      <div className="flex flex-wrap items-center gap-2.5">
        {SWATCHES.map(([c, name]) => {
          const on = value.toLowerCase() === c;
          return (
            <button
              key={c}
              type="button"
              aria-label={name}
              aria-pressed={on}
              title={name}
              onClick={() => onChange(c)}
              className={`h-9 w-9 rounded-full border border-black/10 transition-transform hover:scale-110 ${on ? "ring-2 ring-accent ring-offset-2" : ""}`}
              style={{ background: c }}
            />
          );
        })}
        <label
          title="Custom colour"
          className={`relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-black/10 transition-transform hover:scale-110 ${custom ? "ring-2 ring-accent ring-offset-2" : ""}`}
          style={{
            background: custom ? value : "conic-gradient(#ff375f, #ffd60a, #30d158, #64d2ff, #0a84ff, #bf5af2, #ff375f)"
          }}
        >
          <span className="sr-only">Custom colour</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
      <OverlayPreview color={value} />
    </div>
  );
}

/** Tiny live preview of the overlay style on a dark tile. */
function OverlayPreview({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 240 90" className="h-[90px] w-full max-w-[320px] rounded-2xl bg-[#2c2c2e]" aria-hidden>
      {[
        [40, 30], [52, 22], [64, 20], [76, 22], [88, 30], [46, 48], [82, 48], [64, 58], [56, 70], [72, 70]
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.6} fill={color} />
      ))}
      <polyline points="88,30 118,26 132,26" fill="none" stroke={color} strokeWidth={1.4} />
      <circle cx={88} cy={30} r={3.6} fill={color} />
      <rect x={132} y={14} width={92} height={24} rx={12} fill="rgba(0,0,0,0.5)" stroke={color} strokeOpacity={0.55} />
      <text x={142} y={26} dominantBaseline="central" fontSize={11} fill="#fff" fillOpacity={0.85} fontFamily="-apple-system, Inter, sans-serif">
        Eyes
      </text>
      <text x={214} y={26} dominantBaseline="central" textAnchor="end" fontSize={13} fontWeight={700} fill={color} fontFamily="-apple-system, Inter, sans-serif">
        80
      </text>
    </svg>
  );
}

function RecoverySection({ username }: { username: string }) {
  const [hasCode, setHasCode] = useState<boolean | null>(null);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    api<{ hasCode: boolean }>("/api/auth/recovery-code")
      .then((r) => setHasCode(r.hasCode))
      .catch(() => setHasCode(null));
  }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ recoveryCode: string }>("/api/auth/recovery-code", { body: { password } });
      setCode(r.recoveryCode);
      setHasCode(true);
      setAsking(false);
      setPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create a code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-5 p-6">
      {code ? (
        <RecoveryCodeCard code={code} username={username} continueLabel="Done" onContinue={() => setCode(null)} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[15px] font-medium">Recovery code</p>
              <p className="mt-0.5 text-[13px] text-ink-3">
                {hasCode === false
                  ? "You don't have one yet. Without it, a forgotten password means a lost account."
                  : "Lets you reset your password if you forget it. Making a new one replaces the old one."}
              </p>
            </div>
            {!asking && (
              <Button size="sm" variant={hasCode === false ? "primary" : "plain"} onClick={() => setAsking(true)}>
                {hasCode === false ? "Create" : "New code"}
              </Button>
            )}
          </div>
          {asking && (
            <form onSubmit={generate} className="mt-4 flex flex-col gap-3">
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Confirm your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
              {error && <Notice tone="error">{error}</Notice>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="plain" size="sm" onClick={() => setAsking(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={busy}>
                  Show code
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </Card>
  );
}

function BlockedSection() {
  const [blocked, setBlocked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<{ blocked: string[] }>("/api/blocks")
      .then((r) => setBlocked(r.blocked))
      .catch(() => setBlocked([]));
  }, []);

  if (!blocked || blocked.length === 0) return null;

  async function unblock(u: string) {
    setBusy(u);
    try {
      await api("/api/blocks", { body: { action: "unblock", username: u } });
      setBlocked((b) => (b || []).filter((x) => x !== u));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mt-5 p-6">
      <p className="text-[15px] font-medium">Blocked players</p>
      <p className="mt-0.5 text-[13px] text-ink-3">You won&apos;t be matched with or messaged by these players.</p>
      <ul className="mt-3">
        {blocked.map((u) => (
          <li key={u} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
            <Avatar username={u} hasFace size={34} />
            <span className="flex-1 truncate text-[15px]">{u}</span>
            <Button size="sm" variant="plain" loading={busy === u} onClick={() => unblock(u)}>
              Unblock
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Chevron() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden className="text-ink-4">
      <path d="m1 1 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
