"use client";

import { ScissorsIcon } from "./icons";

const items = [
  { label: "Stats", glyph: "S" },
  { label: "Cosmetics", glyph: <ScissorsIcon className="h-4 w-4" /> },
  { label: "Cosmetics 2", glyph: "X" }
];

export function SideRail() {
  return (
    <div className="pointer-events-auto fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
      {items.map((item, i) => (
        <button
          key={i}
          aria-label={item.label}
          className="glass glass-hover relative flex h-11 w-11 items-center justify-center rounded-l-2xl rounded-r-md text-sm text-mog-violet"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 24px -8px rgba(168, 85, 247, 0.5)"
          }}
        >
          {typeof item.glyph === "string" ? (
            <span className="font-semibold uppercase tracking-wider">
              {item.glyph}
            </span>
          ) : (
            item.glyph
          )}
        </button>
      ))}
    </div>
  );
}
