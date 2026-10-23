// npm run sample-invoice -> out/sample-invoice.pdf
// A sample receipt built from the current restaurant.config.ts and the first dishes in
// prisma/menu.json, laid out like the real /order/[id]/receipt page and marked SAMPLE.
// Razorpay asks for a sample invoice file (PNG, JPG or PDF) when you submit the website.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getIdentity } from "@/lib/identity";
import { parseRupeesToPaise } from "@/lib/money";
import { buildReceipt, type ReceiptOrder } from "@/lib/receipt";
import { buildReceiptPdf } from "@/lib/receiptPdf";

interface MenuFile {
  categories: { items: { name: string; price: string }[] }[];
}

function exampleItems(): ReceiptOrder["items"] {
  const menu = JSON.parse(readFileSync(path.join(process.cwd(), "prisma", "menu.json"), "utf8")) as MenuFile;
  const picked = menu.categories
    .flatMap((c) => c.items)
    .slice(0, 3)
    .flatMap((i, idx) => {
      const pricePaise = parseRupeesToPaise(i.price);
      return pricePaise === null ? [] : [{ name: i.name, quantity: idx === 0 ? 2 : 1, pricePaise }];
    });
  if (picked.length === 0)
    throw new Error("prisma/menu.json has no priced items to use in the sample invoice.");
  return picked;
}

async function main() {
  const id = getIdentity();
  const items = exampleItems();
  const now = new Date().toISOString();
  const order: ReceiptOrder = {
    number: 12,
    type: id.ordering.types.includes("dine_in") ? "dine_in" : "takeaway",
    table: id.ordering.types.includes("dine_in") ? "5" : null,
    paidAt: now,
    createdAt: now,
    refundStatus: "none",
    items,
    totalPaise: items.reduce((sum, i) => sum + i.pricePaise * i.quantity, 0),
  };
  const bytes = await buildReceiptPdf(buildReceipt(id, order), { sample: true });
  const file = path.join(process.cwd(), "out", "sample-invoice.pdf");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  console.log(
    `Wrote ${file} (${bytes.length} bytes). Upload it as the sample invoice on the Razorpay dashboard.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
