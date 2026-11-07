"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { api, ApiError } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { Avatar, Button, Empty, Notice, UserName } from "@/components/ui";
import { Linkified, useVisiblePoll } from "@/components/social/helpers";
import type { PublicProfile } from "@/lib/shared/types";

type Dm = { from: string; text: string; at: number };
type Relation = "self" | "friends" | "outgoing" | "incoming" | "none" | "blocked";

const key = (m: Dm) => `${m.at}:${m.from}:${m.text.length}`;

function dayLabel(at: number) {
  const d = new Date(at);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === new Date(Date.now() - 86400000).toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export default function ConversationPage({ params }: { params: { username: string } }) {
  const target = decodeURIComponent(params.username);
  const { me, loading } = useSession();
  const router = useRouter();

  const [other, setOther] = useState<PublicProfile | null>(null);
  const [relation, setRelation] = useState<Relation | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<Dm[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastAt = useRef(0);
  const scroller = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!loading && !me) router.replace(`/login?next=${encodeURIComponent(`/friends/${target}`)}`);
  }, [loading, me, router, target]);

  // Who are we talking to, and are we allowed to?
  useEffect(() => {
    if (!me) return;
    let alive = true;
    api<{ user: PublicProfile; relation: Relation }>(`/api/users/${encodeURIComponent(target)}`)
      .then((r) => {
        if (!alive) return;
        setOther(r.user);
        setRelation(r.relation);
        if (r.relation === "self") router.replace("/friends?tab=messages");
      })
      .catch((e) => {
        if (alive && e instanceof ApiError && e.status === 404) setNotFound(true);
      });
    return () => {
      alive = false;
    };
  }, [me, target, router]);

  const merge = useCallback((incoming: Dm[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set((prev || []).map(key));
      const next = [...(prev || [])];
      for (const m of incoming) if (!seen.has(key(m))) next.push(m);
      next.sort((a, b) => a.at - b.at);
      lastAt.current = next.length ? next[next.length - 1].at : lastAt.current;
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    if (notFound) return;
    try {
      const after = lastAt.current;
      const r = await api<{ messages: Dm[] }>(
        `/api/messages/${encodeURIComponent(target)}${after ? `?after=${after}` : ""}`
      );
      if (!after) setMessages(r.messages);
      if (!after) lastAt.current = r.messages.length ? r.messages[r.messages.length - 1].at : 0;
      else merge(r.messages);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else if (messages === null) setMessages([]);
    }
  }, [target, merge, notFound, messages]);

  useVisiblePoll(poll, 3_000, !!me);

  // Keep pinned to the newest message unless the user scrolled up.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await api<{ message: Dm }>(`/api/messages/${encodeURIComponent(target)}`, { body: { text: body } });
      setText("");
      stickToBottom.current = true;
      merge([r.message]);
      if (messages === null) setMessages([r.message]);
      inputRef.current?.focus();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setRelation("none");
      setError(e instanceof ApiError ? e.message : "Message didn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  // Auto-grow the composer up to ~5 lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(140, el.scrollHeight)}px`;
  }, [text]);

  if (!me) return <main className="page" />;

  if (notFound) {
    return (
      <main className="page">
        <Empty
          title="Player not found"
          body={`There's no one called “${target}” on Edgify.`}
          action={
            <Link href="/friends?tab=messages" className="text-[15px] font-medium text-accent">
              Back to messages
            </Link>
          }
        />
      </main>
    );
  }

  const name = other?.username || target;
  const canSend = relation === "friends";
  const mineLc = me.username.toLowerCase();

  return (
    <main className="mx-auto flex h-[calc(100dvh-64px)] w-full max-w-[760px] flex-col px-4 pb-[96px] pt-3 sm:px-6 md:pb-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3">
        <Link
          href="/friends?tab=messages"
          aria-label="Back to messages"
          className="flex h-10 w-10 items-center justify-center rounded-full text-accent transition-colors hover:bg-fill"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5.5 8.5 12l6.5 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <Link href={`/u/${name}`} className="flex min-w-0 items-center gap-3">
          <Avatar username={name} hasFace={other ? other.hasFace : false} size={40} online={other?.online} />
          <span className="min-w-0">
            <UserName username={name} className="flex text-[17px] font-semibold text-ink" />
            <span className="block text-[13px] text-ink-3">
              {other ? (other.online ? "Online" : "Offline") : " "}
            </span>
          </span>
        </Link>
      </div>

      {/* Thread */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="card flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
        aria-live="polite"
      >
        {messages === null ? (
          <div className="flex flex-col gap-3 px-1">
            <span className="h-9 w-40 animate-pulse self-start rounded-[20px] bg-fill" />
            <span className="h-9 w-56 animate-pulse self-end rounded-[20px] bg-accent-soft" />
            <span className="h-9 w-32 animate-pulse self-start rounded-[20px] bg-fill" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Empty title={`Say hi to ${name}`} body="Messages are only between friends." />
          </div>
        ) : (
          <ol className="flex flex-col">
            {messages.map((m, i) => {
              const mine = m.from.toLowerCase() === mineLc;
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
              const gap = prev && m.at - prev.at > 10 * 60_000;
              const sameAsPrev = prev && !newDay && !gap && prev.from.toLowerCase() === m.from.toLowerCase();
              const lastInRun =
                !next ||
                next.from.toLowerCase() !== m.from.toLowerCase() ||
                new Date(next.at).toDateString() !== new Date(m.at).toDateString() ||
                next.at - m.at > 10 * 60_000;
              return (
                <li key={key(m)} className="flex flex-col">
                  {(newDay || gap) && (
                    <span className="my-3 self-center text-[12px] font-medium text-ink-3">
                      {dayLabel(m.at)} ·{" "}
                      {new Date(m.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                  <span
                    className={clsx(
                      "max-w-[80%] whitespace-pre-wrap break-words px-4 py-2 text-[16px] leading-[1.35]",
                      sameAsPrev ? "mt-0.5" : "mt-2",
                      mine
                        ? clsx("self-end bg-accent text-white", "rounded-[20px]", lastInRun && "rounded-br-[6px]")
                        : clsx("self-start bg-fill-2 text-ink", "rounded-[20px]", lastInRun && "rounded-bl-[6px]")
                    )}
                    title={new Date(m.at).toLocaleString()}
                  >
                    <Linkified text={m.text} mine={mine} />
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Composer */}
      <div className="pt-3">
        {error && (
          <div className="mb-2">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {relation === "blocked" ? (
          <Notice>
            You blocked {name}.{" "}
            <Link href={`/u/${name}`} className="font-medium text-accent">
              Unblock them on their profile
            </Link>{" "}
            to chat again.
          </Notice>
        ) : relation !== null && !canSend ? (
          <Notice>
            You can only message friends.{" "}
            <Link href={`/u/${name}`} className="font-medium text-accent">
              {relation === "incoming" ? `Accept ${name}'s request` : `Add ${name} as a friend`}
            </Link>{" "}
            to start chatting.
          </Notice>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2 rounded-[26px] bg-white p-1.5 pl-4 shadow-card"
          >
            <label className="flex-1">
              <span className="sr-only">Message {name}</span>
              <textarea
                ref={inputRef}
                rows={1}
                value={text}
                maxLength={1000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Message ${name}`}
                disabled={relation === null}
                className="block max-h-[140px] w-full resize-none bg-transparent py-2 text-[16px] leading-[1.35] text-ink placeholder:text-ink-4 focus:outline-none"
              />
            </label>
            <Button
              type="submit"
              size="sm"
              aria-label="Send"
              className="h-9 w-9 shrink-0 !px-0"
              disabled={!text.trim() || relation === null}
              loading={sending}
            >
              {!sending && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 19V5.5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
