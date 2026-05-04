"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  myFace: string | null;
  oppFace: string | null;
  myName: string;
  oppName: string;
  myScore: number;
  oppScore: number;
};

/**
 * Post-match AI analysis surface — sends both face images to the
 * /api/analysis/match endpoint (which calls Claude with a structured
 * prompt) and renders the response.
 *
 * Hidden entirely if either face is missing (e.g. bot match, or the
 * opponent's snapshot couldn't be captured at match end).
 */
export function DeepAnalysis({
  myFace,
  oppFace,
  myName,
  oppName,
  myScore,
  oppScore
}: Props) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; text: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [open, setOpen] = useState(false);

  if (!myFace || !oppFace) return null;

  async function generate() {
    setState({ kind: "loading" });
    setOpen(true);
    try {
      const res = await fetch("/api/analysis/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          myFace,
          oppFace,
          myName,
          oppName,
          myScore,
          oppScore
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setState({
          kind: "error",
          message: data.message || data.error || "Analysis failed."
        });
        return;
      }
      setState({ kind: "ready", text: data.analysis as string });
    } catch (e) {
      setState({
        kind: "error",
        message: (e as Error).message || "Network error."
      });
    }
  }

  return (
    <div className="mt-7 w-full">
      <div className="rounded-2xl border border-edge-cyan/25 bg-edge-cyan/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-edge-cyan">
              AI · Aesthetic Analysis
            </p>
            <p className="mt-1 text-sm text-white/55">
              Structured breakdown of both faces. Powered by Claude vision.
            </p>
          </div>
          {state.kind === "idle" && (
            <button
              onClick={generate}
              className="rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-cyan hover:bg-edge-cyan/25"
            >
              Generate Analysis →
            </button>
          )}
          {state.kind === "loading" && (
            <span className="inline-flex items-center gap-2 rounded-lg border border-edge-cyan/30 bg-edge-cyan/[0.06] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-edge-cyan">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-edge-cyan" />
                <span
                  className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-edge-cyan"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-edge-cyan"
                  style={{ animationDelay: "0.3s" }}
                />
              </span>
              Analyzing
            </span>
          )}
          {state.kind === "ready" && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
            >
              {open ? "Collapse" : "Expand"}
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-5 border-t border-edge-cyan/15 pt-5 text-left">
                {state.kind === "loading" && (
                  <div className="space-y-3">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-white/[0.06]" />
                    <div className="h-3 w-full animate-pulse rounded bg-white/[0.05]" />
                    <div className="h-3 w-5/6 animate-pulse rounded bg-white/[0.05]" />
                    <div className="h-3 w-4/6 animate-pulse rounded bg-white/[0.05]" />
                    <p className="pt-2 text-[11px] text-white/40">
                      Claude is reviewing both faces — this typically takes
                      8–15 seconds.
                    </p>
                  </div>
                )}

                {state.kind === "error" && (
                  <div className="rounded-lg border border-rose-400/30 bg-rose-500/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-300">
                      Analysis failed
                    </p>
                    <p className="mt-2 text-sm text-white/65">
                      {state.message}
                    </p>
                    <button
                      onClick={generate}
                      className="mt-3 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-white/20 hover:text-white"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {state.kind === "ready" && (
                  <AnalysisRender text={state.text} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Privacy note — surfaced once before generation. */}
        {state.kind === "idle" && (
          <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-white/30">
            Both face snapshots are sent to Anthropic for this analysis. They
            aren&apos;t stored after the response is returned.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Lightweight markdown renderer for the analysis output. We avoid pulling
 * in react-markdown — the structure Claude emits is predictable
 * (numbered headings, hyphen bullets, bold spans), so a small parser
 * keeps the bundle lean.
 */
function AnalysisRender({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  type Block =
    | { kind: "h1"; text: string }
    | { kind: "h2"; text: string }
    | { kind: "p"; text: string }
    | { kind: "ul"; items: string[] }
    | { kind: "blank" };

  const blocks: Block[] = [];
  let buf: string[] = [];

  function flushList() {
    if (buf.length > 0) {
      blocks.push({ kind: "ul", items: buf });
      buf = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      blocks.push({ kind: "blank" });
      continue;
    }
    // Numbered top-level heading: "1. OVERALL SUMMARY"
    if (/^\d+\.\s+[A-Z][A-Z\s\-&]{2,}$/.test(line)) {
      flushList();
      blocks.push({ kind: "h1", text: line });
      continue;
    }
    // Markdown-style heading: "## ..." or "# ..."
    if (/^#{1,3}\s+/.test(line)) {
      flushList();
      const stripped = line.replace(/^#{1,3}\s+/, "");
      blocks.push({ kind: "h2", text: stripped });
      continue;
    }
    // Bullet item: "- ..." or "• ..."
    if (/^(?:[-•*]\s+)/.test(line)) {
      buf.push(line.replace(/^(?:[-•*]\s+)/, ""));
      continue;
    }
    // Bold-only line acting as a sub-heading: "**Person A:** ..."
    flushList();
    blocks.push({ kind: "p", text: line });
  }
  flushList();

  return (
    <div className="space-y-4 text-sm leading-relaxed text-white/75">
      {blocks.map((b, i) => {
        if (b.kind === "blank") return null;
        if (b.kind === "h1") {
          return (
            <h3
              key={i}
              className="pt-2 text-[11px] font-bold uppercase tracking-[0.32em] text-edge-cyan"
            >
              {b.text}
            </h3>
          );
        }
        if (b.kind === "h2") {
          return (
            <h4
              key={i}
              className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white/90"
            >
              {renderInline(b.text)}
            </h4>
          );
        }
        if (b.kind === "p") {
          return (
            <p key={i} className="text-white/70">
              {renderInline(b.text)}
            </p>
          );
        }
        return (
          <ul key={i} className="space-y-1.5 pl-1">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2.5 text-white/70">
                <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-edge-cyan/70" />
                <span>{renderInline(it)}</span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

/**
 * Render bold (**…**) and italic (*…*) inline spans. Anything else is
 * passed through as-is. Returns a fragment of React nodes.
 */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(
        <em key={key++} className="italic text-white/80">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
