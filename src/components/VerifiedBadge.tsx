/**
 * Auto-grant "verified" check at 50+ matches played. Visual marker so
 * other players know an account is established (not a fresh throwaway).
 */
export function VerifiedBadge({
  matchesPlayed
}: {
  matchesPlayed: number;
}) {
  if (matchesPlayed < 50) return null;
  return (
    <span
      className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-black"
      style={{
        background: "linear-gradient(135deg, #22e9ff, #b9f8ff)"
      }}
      title="Verified · 50+ matches played"
    >
      ✓
    </span>
  );
}
