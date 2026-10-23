import type { Metadata } from "next";
import { adminStrings } from "@/content/adminStrings";
import { getAdminMenu } from "@/server/admin/menu";
import { MenuEditor } from "./MenuEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: adminStrings.nav.menu };

export default async function AdminMenuPage() {
  return <MenuEditor initial={await getAdminMenu()} />;
}
