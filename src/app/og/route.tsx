// Default social-share image (1200x630), drawn from the restaurant name and theme.
// Restaurants with a real photo set restaurant.ogImage to "/restaurant/og.jpg" instead.
import { ImageResponse } from "next/og";
import { theme } from "@/config";
import { getIdentity } from "@/lib/identity";

export const dynamic = "force-static";

export function GET() {
  const c = theme.colours;
  const id = getIdentity();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: c.background,
        color: c.text,
      }}
    >
      <div style={{ width: 120, height: 12, background: c.primary, marginBottom: 40 }} />
      <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.1 }}>{id.tradeName}</div>
      <div style={{ fontSize: 40, marginTop: 24, color: c.muted }}>{id.tagline}</div>
      <div style={{ fontSize: 32, marginTop: 48, color: c.primary }}>
        {`Order online · ${id.area}, ${id.city}`}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
