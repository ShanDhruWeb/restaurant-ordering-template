import type { Metadata } from "next";
import Link from "next/link";
import { VegMark } from "@/components/VegMark";
import { strings } from "@/content/strings";
import { getIdentity } from "@/lib/identity";
import { formatRupees } from "@/lib/money";
import { pageMetadata } from "@/lib/seo";
import { getPublicMenu } from "@/server/menu";

export const metadata: Metadata = pageMetadata("/pricing");
// Prices come from the database, so this page is always fresh.
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const id = getIdentity();
  const { categories } = await getPublicMenu();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="-ml-2 inline-flex h-11 items-center px-2 font-semibold text-primary">
        ← {strings.pages.goHome}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{strings.pricing.title}</h1>
      <p className="mt-2 text-muted">
        {id.tradeName}. {strings.pricing.intro} {id.ordering.taxNote}
      </p>
      <Link
        href="/#menu"
        className="mt-4 inline-flex h-12 items-center rounded-pill bg-primary px-6 font-semibold text-on-primary"
      >
        {strings.pricing.orderNow}
      </Link>
      {categories.length === 0 && <p className="mt-10 text-muted">{strings.pricing.empty}</p>}
      {categories.map((cat) => (
        <section key={cat.id} aria-labelledby={`p-${cat.id}`} className="mt-8">
          <h2 id={`p-${cat.id}`} className="text-xl font-bold">
            {cat.name}
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {cat.items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 py-3">
                {item.imagePath && (
                  // eslint-disable-next-line @next/next/no-img-element -- small local photos
                  <img
                    src={item.imagePath}
                    alt={item.name}
                    width={56}
                    height={56}
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-card object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <VegMark isVeg={item.isVeg} />
                    <span>{item.name}</span>
                  </p>
                  {item.description && <p className="mt-0.5 text-sm text-muted">{item.description}</p>}
                  {!item.isAvailable && (
                    <p className="mt-0.5 text-sm text-muted">{strings.pricing.soldOut}</p>
                  )}
                </div>
                <p className="shrink-0 font-semibold">{formatRupees(item.pricePaise)}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
