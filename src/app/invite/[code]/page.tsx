import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Friend invite deep-link. Redirects into the arena flow with the
 * `?join=CODE` query param so the live-match component auto-joins
 * the matching private room. Kept as a tiny redirect page so links
 * are short and shareable.
 */
export default function InvitePage({
  params
}: {
  params: { code: string };
}) {
  const code = (params.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (code.length !== 6) {
    redirect("/arena");
  }
  redirect(`/arena?join=${code}`);
}
