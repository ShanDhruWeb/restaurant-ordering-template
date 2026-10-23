import type { Metadata } from "next";
import Link from "next/link";
import { strings } from "@/content/strings";
import { getIdentity, hoursText } from "@/lib/identity";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("/contact");

export default function ContactPage() {
  const id = getIdentity();
  const wa = id.whatsapp?.replace(/\D/g, "");
  const button = "inline-flex h-12 items-center justify-center rounded-pill px-5 font-semibold";
  const link = "underline underline-offset-4";
  const label = "text-sm font-semibold text-muted";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="-ml-2 inline-flex h-11 items-center px-2 font-semibold text-primary">
        ← {strings.pages.goHome}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{strings.pages.contactTitle}</h1>
      <p className="mt-2 text-muted">{id.tradeName}</p>
      <dl className="mt-6 space-y-5">
        <div>
          <dt className={label}>{strings.pages.address}</dt>
          <dd className="mt-1">{id.operatingAddressText}</dd>
        </div>
        {id.addressesDiffer && (
          <div>
            <dt className={label}>{strings.pages.registeredAddress}</dt>
            <dd className="mt-1">
              {id.legalName}, {id.registeredAddressText}
            </dd>
          </div>
        )}
        <div>
          <dt className={label}>{strings.pages.hours}</dt>
          <dd className="mt-1">{hoursText(id)}</dd>
        </div>
        <div>
          <dt className={label}>{strings.pages.phone}</dt>
          <dd className="mt-1">
            <a href={id.phoneHref} className={link}>
              {id.phone}
            </a>
          </dd>
        </div>
        <div>
          <dt className={label}>{strings.pages.email}</dt>
          <dd className="mt-1">
            <a href={id.emailHref} className={link}>
              {id.email}
            </a>
          </dd>
        </div>
        <div>
          <dt className={label}>{strings.pages.grievance}</dt>
          <dd className="mt-1">
            {id.grievance.name}:{" "}
            <a href={id.grievance.emailHref} className={link}>
              {id.grievance.email}
            </a>
            ,{" "}
            <a href={id.grievance.phoneHref} className={link}>
              {id.grievance.phone}
            </a>
          </dd>
        </div>
      </dl>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href={id.phoneHref} className={`${button} bg-primary text-on-primary`}>
          {strings.common.callUs}
        </a>
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            rel="noopener"
            className={`${button} border border-line bg-surface`}
          >
            {strings.common.whatsapp}
          </a>
        )}
        {id.mapsUrl && (
          <a href={id.mapsUrl} rel="noopener" className={`${button} border border-line bg-surface`}>
            {strings.common.directions}
          </a>
        )}
      </div>
    </main>
  );
}
