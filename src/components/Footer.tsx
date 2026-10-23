import Link from "next/link";
import { strings } from "@/content/strings";
import { copyrightYear, getIdentity } from "@/lib/identity";
import { FOOTER_PAGES } from "@/lib/seo";

/** Shared footer: rendered by the (shop) layout, so it is on every public route. */
export function Footer() {
  const id = getIdentity();
  const f = strings.footer;
  return (
    <footer className="no-print mt-12 border-t border-line bg-surface px-4 pt-8 pb-28 text-sm text-muted">
      <div className="mx-auto max-w-3xl space-y-3">
        <p className="font-heading text-base font-semibold text-ink" data-identity="trade-name">
          {id.tradeName}
        </p>
        <p>
          {f.soldBy} <span data-identity="legal-name">{id.legalName}</span>
        </p>
        <p data-identity="address">{id.operatingAddressText}</p>
        {id.addressesDiffer && <p>{f.registeredAt(id.registeredAddressText)}</p>}
        <p className="flex flex-wrap gap-x-4">
          <a href={id.phoneHref} className="inline-block py-1 underline underline-offset-4">
            {id.phone}
          </a>
          <a href={id.emailHref} className="inline-block py-1 underline underline-offset-4">
            {id.email}
          </a>
        </p>
        <nav aria-label={f.policies}>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {FOOTER_PAGES.map((p) => (
              <li key={p.path}>
                <Link href={p.path} className="inline-block py-2 underline underline-offset-4">
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {(id.fssai || id.gstin) && (
          <p className="space-x-3">
            {id.fssai && <span>{f.fssai(id.fssai)}</span>}
            {id.gstin && <span>{f.gstin(id.gstin)}</span>}
          </p>
        )}
        <p>{f.razorpay}</p>
        <p>{f.copyright(copyrightYear(), id.legalName)}</p>
        {id.agency.showCredit && id.agency.name && (
          <p className="text-xs">
            {id.agency.url ? (
              <a href={id.agency.url} rel="noopener" className="underline underline-offset-4">
                {f.websiteBy(id.agency.name)}
              </a>
            ) : (
              f.websiteBy(id.agency.name)
            )}
          </p>
        )}
      </div>
    </footer>
  );
}
