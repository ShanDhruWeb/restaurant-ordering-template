import { canonicalUrl, getIdentity } from "@/lib/identity";

const DAY_NAMES = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** schema.org Restaurant data for search engines. Built only from config, never user input. */
export function RestaurantJsonLd() {
  const id = getIdentity();
  const a = id.operatingAddress;
  const data = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: id.tradeName,
    legalName: id.legalName,
    description: id.description,
    url: id.siteUrl,
    telephone: id.phone,
    email: id.email,
    image: `${id.siteUrl}${id.ogImage}`,
    logo: `${id.siteUrl}${id.logo}`,
    servesCuisine: id.cuisines,
    acceptsReservations: false,
    hasMenu: canonicalUrl("/pricing", id),
    ...(id.gstin ? { taxID: id.gstin } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: `${a.line1}, ${a.area}`,
      addressLocality: a.city,
      postalCode: a.pincode,
      addressCountry: "IN",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: id.hours.days.map((d) => DAY_NAMES[d]),
        opens: id.hours.open,
        closes: id.hours.close,
      },
    ],
    sameAs: Object.values(id.socials).filter(Boolean),
  };
  // JSON.stringify output with "<" escaped cannot break out of the script tag.
  const json = JSON.stringify(data).replace(/</g, "\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
