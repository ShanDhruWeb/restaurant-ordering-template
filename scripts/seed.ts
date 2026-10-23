// npm run db:seed            -> add missing categories/items from prisma/menu.json
// npm run db:seed -- --force -> also overwrite names/prices/availability from the file
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { seedMenu } from "@/server/seed";

async function main() {
  const force = process.argv.includes("--force");
  const file = path.join(process.cwd(), "prisma", "menu.json");
  const menu: unknown = JSON.parse(readFileSync(file, "utf8"));
  const result = await seedMenu(prisma, menu, { force });
  console.log(
    `Seed done. Categories created: ${result.categoriesCreated}. Items created: ${result.itemsCreated}, ` +
      `updated: ${result.itemsUpdated}, left unchanged: ${result.skipped}.` +
      (force ? "" : " (Run with --force to overwrite existing items from menu.json.)"),
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
