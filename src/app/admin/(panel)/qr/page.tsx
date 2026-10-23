import type { Metadata } from "next";
import QRCode from "qrcode";
import { tableLabels } from "@/config";
import { getIdentity } from "@/lib/identity";
import { adminStrings } from "@/content/adminStrings";
import { getEnv } from "@/lib/env";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: adminStrings.nav.qr };

const t = adminStrings.qr;

async function svg(url: string): Promise<string> {
  // Black on white for reliable scanning, whatever the theme colours are.
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}

export default async function QrPage() {
  const site = getEnv().siteUrl;
  const codes = [
    { label: t.menuLink, url: `${site}/` },
    ...tableLabels.map((label) => ({
      label: t.table(label),
      url: `${site}/?t=${encodeURIComponent(label)}`,
    })),
  ];
  const rendered = await Promise.all(codes.map(async (c) => ({ ...c, svg: await svg(c.url) })));

  return (
    <div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted">{t.intro}</p>
        </div>
        <PrintButton label={t.print} />
      </div>
      {/* Printable A4 sheet: 2 x 3 cards per page. */}
      <div className="qr-sheet mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-2">
        {rendered.map((c) => (
          <figure
            key={c.url}
            className="qr-card flex flex-col items-center rounded-card border-2 border-ink bg-surface p-4 text-center"
          >
            <p className="font-heading text-lg font-bold">{getIdentity().tradeName}</p>
            {/* SVG generated server-side by the qrcode library from our own URL, never user input. */}
            <div className="mt-2 w-full max-w-48" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <figcaption className="mt-2">
              <span className="block text-2xl font-bold">{c.label}</span>
              <span className="block font-semibold">{t.scanToOrder}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
