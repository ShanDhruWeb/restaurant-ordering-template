// Shared helpers for integration tests (real Postgres from DATABASE_URL_TEST).
import { describe } from "vitest";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { buildWebhook, type MockPaymentEntity } from "@/server/payments/mockWebhook";
import { hmacSha256Hex } from "@/server/payments/signature";

export const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);

/** describe() that is skipped (visibly) when there is no test database. */
export const describeDb = hasTestDb ? describe : describe.skip;

const TABLES = [
  "OrderItem",
  "Payment",
  "Order",
  "MenuItem",
  "Category",
  "WebhookEvent",
  "DailyCounter",
  "Setting",
  "AuditLog",
  "AdminUser",
  "RateLimit",
  "MockGatewayPayment",
];

export async function resetDb() {
  // Fixed table names, no user input. Test database only (see tests/setup.ts).
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
  await prisma.setting.create({ data: { id: 1 } });
}

export async function seedItems() {
  const cat = await prisma.category.create({ data: { name: "Mains" } });
  const make = (name: string, pricePaise: number, extra: { isAvailable?: boolean; deletedAt?: Date } = {}) =>
    prisma.menuItem.create({ data: { categoryId: cat.id, name, pricePaise, ...extra } });
  return {
    thali: await make("Thali", 22000),
    chai: await make("Chai", 2000),
    soldOut: await make("Biryani", 38000, { isAvailable: false }),
    deleted: await make("Old item", 5000, { deletedAt: new Date() }),
  };
}

export function orderInput(
  items: { menuItemId: string; quantity: number }[],
  extra: Record<string, unknown> = {},
) {
  return {
    type: "takeaway" as const,
    customerName: "Asha Patil",
    customerPhone: "9876543210",
    termsAccepted: true,
    items,
    ...extra,
  };
}

export function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export const routeParams = (id: string) => ({ params: Promise.resolve({ id }) });

export function signedWebhook(
  event: Parameters<typeof buildWebhook>[0],
  payment: MockPaymentEntity,
  opts: Parameters<typeof buildWebhook>[3] = {},
) {
  return buildWebhook(event, payment, getEnv().razorpay.webhookSecret, opts);
}

export function webhookRequest(hook: { body: string; headers: Record<string, string> }) {
  return new Request("http://localhost:3000/api/webhooks/razorpay", {
    method: "POST",
    headers: hook.headers,
    body: hook.body,
  });
}

export function checkoutSignature(razorpayOrderId: string, razorpayPaymentId: string) {
  return hmacSha256Hex(getEnv().razorpay.keySecret, `${razorpayOrderId}|${razorpayPaymentId}`);
}
