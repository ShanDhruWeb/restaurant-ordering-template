import type { Metadata } from "next";
import { adminStrings } from "@/content/adminStrings";
import { getLaunchChecklist } from "@/server/admin/launchChecklist";
import { getBoard } from "@/server/admin/orders";
import { LaunchChecklist } from "./LaunchChecklist";
import { OrdersBoard } from "./OrdersBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: adminStrings.nav.orders };

export default async function AdminHome() {
  const [board, checklist] = await Promise.all([getBoard(), getLaunchChecklist()]);
  return (
    <>
      <LaunchChecklist items={checklist} />
      <OrdersBoard initial={board} />
    </>
  );
}
