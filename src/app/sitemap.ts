import type { MetadataRoute } from "next";
import { canonicalUrl, getIdentity } from "@/lib/identity";
import { PUBLIC_PAGES } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const id = getIdentity();
  return PUBLIC_PAGES.map((p) => ({ url: canonicalUrl(p.path, id) }));
}
