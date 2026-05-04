import { isOwnerName } from "@/lib/owner";

/**
 * Tiny gradient "OWNER" pill. Renders nothing if the name isn't the
 * owner's, so callers can drop it next to any username without
 * conditional logic at the call site.
 */
export function OwnerBadge({
  name,
  size = "md"
}: {
  name: string | null | undefined;
  size?: "xs" | "sm" | "md";
}) {
  if (!isOwnerName(name)) return null;
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
        background: "linear-gradient(90deg, #22e9ff 0%, #ff5d8f 100%)"
      }}
      title="Project owner"
    >
      Owner
    </span>
  );
}
