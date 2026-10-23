import type { Metadata } from "next";
import { config, tableLabels } from "@/config";
import { HomeIntro } from "@/components/HomeIntro";
import { RestaurantJsonLd } from "@/components/JsonLd";
import { getIdentity } from "@/lib/identity";
import { pageMetadata } from "@/lib/seo";
import { formatHHMM } from "@/lib/time";
import { getPublicMenu } from "@/server/menu";
import { MenuView } from "./MenuView";

export const metadata: Metadata = pageMetadata("/");
// Always fresh: menu and availability come from the database.
export const dynamic = "force-dynamic";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const params = await searchParams;
  const t = typeof params.t === "string" ? params.t.trim() : "";
  const table = t && tableLabels.includes(t) ? t : null;
  const menu = await getPublicMenu();
  const id = getIdentity();

  return (
    <>
      <RestaurantJsonLd />
      <MenuView
        initialMenu={menu}
        tableFromQr={table}
        restaurant={{
          name: id.tradeName,
          tagline: id.tagline,
          logo: id.logo,
          phone: id.phone,
          open: formatHHMM(id.hours.open),
          close: formatHHMM(id.hours.close),
        }}
        limits={{
          maxQtyPerItem: config.ordering.maxQtyPerItem,
          maxItemsPerOrder: config.ordering.maxItemsPerOrder,
        }}
        taxNote={id.ordering.taxNote}
        intro={<HomeIntro />}
      />
    </>
  );
}
