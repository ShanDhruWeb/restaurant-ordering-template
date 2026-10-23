import { config, tableLabels } from "@/config";
import { RestaurantJsonLd } from "@/components/JsonLd";
import { formatHHMM } from "@/lib/time";
import { getPublicMenu } from "@/server/menu";
import { MenuView } from "./MenuView";

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
  const r = config.restaurant;

  return (
    <>
      <RestaurantJsonLd />
      <MenuView
        initialMenu={menu}
        tableFromQr={table}
        restaurant={{
          name: r.name,
          tagline: r.tagline,
          logo: r.logo,
          phone: r.phone,
          area: r.address.area,
          open: formatHHMM(r.hours.open),
          close: formatHHMM(r.hours.close),
        }}
        limits={{
          maxQtyPerItem: config.ordering.maxQtyPerItem,
          maxItemsPerOrder: config.ordering.maxItemsPerOrder,
        }}
        taxNote={config.ordering.taxNote}
      />
    </>
  );
}
