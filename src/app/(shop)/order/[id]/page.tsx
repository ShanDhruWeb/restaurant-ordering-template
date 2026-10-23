import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getIdentity } from "@/lib/identity";
import { getPublicOrder } from "@/server/orders/publicOrder";
import { OrderTracker } from "./OrderTracker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) notFound();
  const order = await getPublicOrder(id);
  if (!order) notFound();
  return <OrderTracker initial={order} refundTimeline={getIdentity().policies.refundTimelineText} />;
}
