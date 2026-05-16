import type { MetadataRoute } from "next";

/**
 * Robots policy. Public profile/leaderboard/season pages are indexable;
 * everything under /admin, /api, /settings, /profile (private dashboard),
 * and the live-match flow stays out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/admin/",
          "/settings",
          "/profile",
          "/arena",
          "/private",
          "/play/",
          "/challenge/",
          "/replay/",
          "/inbox",
          "/r/"
        ]
      }
    ],
    sitemap: "https://edgify.cc/sitemap.xml"
  };
}
