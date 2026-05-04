import type { ReactNode } from "react";

/**
 * Tiny skeleton primitive — animated pulse over a glass-tinted block.
 * Used to indicate "data is loading" without showing raw text.
 */
export function Skeleton({
  className = "",
  rows = 1
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={"space-y-2 " + className}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-white/[0.06]"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Friendly empty state for "no data yet" surfaces. Configurable
 * icon/title/hint with an optional CTA.
 */
export function EmptyState({
  icon = "🌑",
  title,
  hint,
  cta
}: {
  icon?: string;
  title: string;
  hint?: string;
  cta?: ReactNode;
}) {
  return (
    <div className="glass rounded-2xl px-6 py-12 text-center">
      <div className="mb-4 text-5xl opacity-70">{icon}</div>
      <h3 className="heading-display text-2xl">{title}</h3>
      {hint && (
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">{hint}</p>
      )}
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}
