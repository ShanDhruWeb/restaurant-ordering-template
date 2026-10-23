import type { MetadataRoute } from "next";
import { theme } from "@/config";
import { getIdentity } from "@/lib/identity";

export default function manifest(): MetadataRoute.Manifest {
  const id = getIdentity();
  return {
    name: id.tradeName,
    short_name: id.shortName,
    description: id.description,
    start_url: "/",
    display: "standalone",
    background_color: theme.colours.background,
    theme_color: theme.colours.primary,
    icons: [{ src: id.logo, sizes: "any", type: "image/svg+xml" }],
  };
}
