import type { MetadataRoute } from "next";
import { config, theme } from "@/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: config.restaurant.name,
    short_name: config.restaurant.shortName,
    description: config.restaurant.description,
    start_url: "/",
    display: "standalone",
    background_color: theme.colours.background,
    theme_color: theme.colours.primary,
    icons: [{ src: config.restaurant.logo, sizes: "any", type: "image/svg+xml" }],
  };
}
