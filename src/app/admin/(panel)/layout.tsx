import type { ReactNode } from "react";
import { getIdentity } from "@/lib/identity";
import { requireAdminPage } from "@/server/admin/guard";
import { AdminNav } from "./AdminNav";

// Every page inside (panel) requires a logged-in admin.
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminPage();
  return (
    <div className="min-h-dvh">
      <AdminNav restaurantName={getIdentity().shortName} email={admin.email} />
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4">{children}</div>
    </div>
  );
}
