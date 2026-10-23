import type { Metadata } from "next";
import { adminStrings } from "@/content/adminStrings";
import { getBoard } from "@/server/admin/orders";
import { OrdersBoard } from "./OrdersBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: adminStrings.nav.orders };

export default async function AdminHome() {
  return <OrdersBoard initial={await getBoard()} />;
}
