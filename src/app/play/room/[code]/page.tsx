"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { Button, ButtonLink, Card } from "@/components/ui";
import { CenteredSpinner, ErrorCard, copyText, useRequireSignIn } from "@/components/play/common";

type Room = { code: string; host: string; createdAt: number; matchId: string | null; guest: string | null };

export default function RoomPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { me } = useRequireSignIn();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const joining = useRef(false);

  const isHost = !!room && !!me && room.host.toLowerCase() === me.username.toLowerCase();

  // Load the room; guests join straight away.
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api<{ room: Room }>(`/api/rooms/${code}`);
        if (cancelled) return;
        const host = r.room.host.toLowerCase() === me.username.toLowerCase();
        if (host) {
          setRoom(r.room);
          if (r.room.matchId) router.replace(`/play/match/${r.room.matchId}`);
          return;
        }
        if (joining.current) return;
        joining.current = true;
        const j = await api<{ room: Room }>(`/api/rooms/${code}`, { method: "POST" });
        if (!cancelled && j.room.matchId) router.replace(`/play/match/${j.room.matchId}`);
      } catch (e) {
        if (cancelled) return;
        joining.current = false;
        const err = e instanceof ApiError ? e : null;
        if (err?.code === "no_room") {
          setError({ title: "Room not found", body: "That code doesn't exist or has expired. Ask your friend for a new one." });
        } else if (err?.code === "room_full") {
          setError({ title: "Room is full", body: "Someone already joined this room." });
        } else {
          setError({ title: "Couldn't join", body: err?.message || "Something went wrong. Try again." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me, code, router]);

  // Host waits for a guest.
  useEffect(() => {
    if (!isHost) return;
    let stop = false;
    const tick = async () => {
      while (!stop) {
        await new Promise((r) => setTimeout(r, 1500));
        if (stop) return;
        try {
          const r = await api<{ room: Room }>(`/api/rooms/${code}`);
          if (r.room.matchId) {
            router.replace(`/play/match/${r.room.matchId}`);
            return;
          }
        } catch (e) {
          if (e instanceof ApiError && e.code === "no_room") {
            setError({ title: "Room expired", body: "Nobody joined in time. Create a new room to try again." });
            return;
          }
        }
      }
    };
    tick();
    return () => {
      stop = true;
    };
  }, [isHost, code, router]);

  if (error) {
    return (
      <main className="page">
        <ErrorCard
          title={error.title}
          body={error.body}
          action={<ButtonLink href="/play">Back to Play</ButtonLink>}
        />
      </main>
    );
  }

  if (!me || !room || !isHost) {
    return (
      <main className="page">
        <CenteredSpinner label={room ? undefined : "Joining room…"} />
      </main>
    );
  }

  const link = typeof window !== "undefined" ? `${window.location.origin}/play/room/${code}` : "";

  return (
    <main className="page">
      <Card className="mx-auto max-w-lg p-8 text-center md:p-12">
        <p className="eyebrow">Private room</p>
        <h1 className="display mt-2 text-[30px]">Invite a friend</h1>
        <p className="mt-2 text-[15px] text-ink-3">Share this code or link. The match starts as soon as they join.</p>

        <div className="mx-auto mt-8 w-fit rounded-3xl bg-fill px-8 py-5">
          <span className="font-mono text-[40px] font-semibold tracking-[0.22em] text-ink md:text-[48px]">{code}</span>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            variant="secondary"
            onClick={async () => {
              if (await copyText(link)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }
            }}
          >
            {copied ? "Link copied" : "Copy invite link"}
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button
              variant="plain"
              onClick={() => navigator.share({ title: "Face off with me on Edgify", url: link }).catch(() => {})}
            >
              Share…
            </Button>
          )}
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-[15px] text-ink-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          Waiting for your friend to join…
        </div>
        <p className="mt-2 text-[13px] text-ink-4">Rooms expire after 20 minutes.</p>
      </Card>
    </main>
  );
}
