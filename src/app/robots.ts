import type { MetadataRoute } from "next";
import { getIdentity } from "@/lib/identity";

// Public pages are open to every crawler. Staff, API, order and checkout pages are not.
export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = getIdentity();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/order", "/checkout"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
