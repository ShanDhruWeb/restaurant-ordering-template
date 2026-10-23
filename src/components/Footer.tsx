import Link from "next/link";
import { config } from "@/config";
import { strings } from "@/content/strings";

export function Footer() {
  const { restaurant, legal, agency } = config;
  const links = [
    { href: "/contact", label: strings.footer.contact },
    { href: "/terms", label: strings.footer.terms },
    { href: "/privacy", label: strings.footer.privacy },
    { href: "/refunds", label: strings.footer.refunds },
  ];
  return (
    <footer className="no-print mt-12 border-t border-line bg-surface px-4 pt-8 pb-28 text-sm text-muted">
      <div className="mx-auto max-w-3xl space-y-3">
        <p className="font-heading text-base font-semibold text-ink">{restaurant.name}</p>
        <p>
          {restaurant.address.line1}, {restaurant.address.area}, {restaurant.address.city}{" "}
          {restaurant.address.pincode}
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-block py-2 underline underline-offset-4">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p>{legal.businessLegalName}</p>
        {(legal.fssai || legal.gstin) && (
          <p className="space-x-3">
            {legal.fssai && <span>{strings.footer.fssai(legal.fssai)}</span>}
            {legal.gstin && <span>{strings.footer.gstin(legal.gstin)}</span>}
          </p>
        )}
        {agency.showCredit && agency.name && (
          <p className="text-xs">
            {agency.url ? (
              <a href={agency.url} rel="noopener" className="underline underline-offset-4">
                {strings.footer.websiteBy(agency.name)}
              </a>
            ) : (
              strings.footer.websiteBy(agency.name)
            )}
          </p>
        )}
      </div>
    </footer>
  );
}
