/**
 * Gold-gradient "PRO" badge shown next to a username when the user has
 * an active Edgify Pro subscription. Mirrors the OwnerBadge pattern so
 * call-sites can drop it next to any name unconditionally.
 */
export function ProBadge({
  active,
  size = "md"
}: {
  active: boolean | null | undefined;
  size?: "xs" | "sm" | "md";
}) {
  if (!active) return null;
  const sizeCls =
    size === "xs"
      ? "px-1 py-0.5 text-[7px]"
      : size === "sm"
        ? "px-1.5 py-0.5 text-[8px]"
        : "px-2 py-0.5 text-[9px]";
  return (
    <span
      className={`ml-1.5 inline-flex items-center rounded-full font-bold uppercase tracking-[0.22em] text-black ${sizeCls}`}
      style={{
        background: "linear-gradient(135deg, #fde047, #f97316)"
      }}
      title="Edgify Pro"
    >
      Pro
    </span>
  );
}
