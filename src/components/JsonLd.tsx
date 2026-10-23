import { config } from "@/config";

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
  const r = config.restaurant;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const data = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: r.name,
    description: r.description,
    url: site,
    telephone: r.phone,
    email: r.email,
    image: `${site}${r.ogImage}`,
    logo: `${site}${r.logo}`,
    servesCuisine: r.cuisines,
    acceptsReservations: false,
    hasMenu: `${site}/`,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${r.address.line1}, ${r.address.area}`,
      addressLocality: r.address.city,
      postalCode: r.address.pincode,
      addressCountry: "IN",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: r.hours.days.map((d) => DAY_NAMES[d]),
        opens: r.hours.open,
        closes: r.hours.close,
      },
    ],
    sameAs: Object.values(r.socials).filter(Boolean),
  };
  // JSON.stringify output with "<" escaped cannot break out of the script tag.
  const json = JSON.stringify(data).replace(/</g, "\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
