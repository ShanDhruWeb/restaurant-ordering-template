// Draws a Receipt (src/lib/receipt.ts) as a one-page A4 PDF using pdf-lib, which is pure
// JavaScript, so it works on any machine without a browser. Used by `npm run sample-invoice`.
//
// The standard PDF fonts cannot draw the rupee sign, so amounts print as "Rs." here;
// the on-screen receipt uses the real symbol.
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatRupees } from "@/lib/money";
import { RECEIPT_TEXT, type Receipt } from "@/lib/receipt";

/** Replace anything the built-in font cannot encode. */
export function pdfSafe(text: string): string {
  return text
    .replace(/₹/g, "Rs. ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E -ÿ]/g, "?");
}

const rs = (paise: number) => pdfSafe(formatRupees(paise));

export async function buildReceiptPdf(
  receipt: Receipt,
  opts: { sample?: boolean } = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`${RECEIPT_TEXT.title} #${receipt.orderNumber}${opts.sample ? " (SAMPLE)" : ""}`));
  pdf.setAuthor(pdfSafe(receipt.legalName));
  const page = pdf.addPage([595.28, 841.89]); // A4 in points
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.4, 0.4, 0.4);
  const left = 50;
  const right = 595.28 - 50;
  let y = 790;

  const text = (s: string, x: number, size = 11, f = font, color = ink) =>
    page.drawText(pdfSafe(s), { x, y, size, font: f, color });
  const textRight = (s: string, xRight: number, size = 11, f = font) => {
    const safe = pdfSafe(s);
    page.drawText(safe, { x: xRight - f.widthOfTextAtSize(safe, size), y, size, font: f, color: ink });
  };
  const line = (gap = 16) => {
    y -= gap;
  };

  text(receipt.legalName, left, 16, bold);
  line(18);
  if (receipt.legalName !== receipt.tradeName) {
    text(receipt.tradeName, left, 11, font, muted);
    line();
  }
  text(receipt.address, left, 10);
  line(14);
  if (receipt.gstin) {
    text(`GSTIN: ${receipt.gstin}`, left, 10);
    line(14);
  }
  if (receipt.fssai) {
    text(`FSSAI: ${receipt.fssai}`, left, 10);
    line(14);
  }

  line(14);
  text(RECEIPT_TEXT.title, left, 22, bold);
  line(26);
  for (const [k, v] of [
    ["Order number", `#${receipt.orderNumber}`],
    ["Date and time", `${receipt.dateTime} IST`],
    ["Order type", receipt.orderType],
  ] as const) {
    text(k, left, 10, font, muted);
    text(v, left + 110, 10);
    line(15);
  }

  // Items table.
  line(10);
  const qtyX = right - 170;
  const priceX = right - 95;
  text("Item", left, 10, bold);
  textRight("Qty", qtyX, 10, bold);
  textRight("Price", priceX, 10, bold);
  textRight("Amount", right, 10, bold);
  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.7, color: muted });
  line(16);
  for (const l of receipt.lines) {
    text(l.name.length > 52 ? `${l.name.slice(0, 51)}...` : l.name, left, 10.5);
    textRight(String(l.quantity), qtyX, 10.5);
    textRight(rs(l.unitPaise), priceX, 10.5);
    textRight(rs(l.totalPaise), right, 10.5);
    line(16);
  }
  y += 4;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.7, color: muted });
  line(20);
  textRight(`${"Total"}   ${rs(receipt.totalPaise)}`, right, 13, bold);

  line(30);
  text(receipt.paymentStatus, left, 11, bold);
  line(16);
  text(receipt.taxStatement, left, 10, font, muted);
  line(14);
  text(RECEIPT_TEXT.notTaxInvoice, left, 10, font, muted);

  if (opts.sample) {
    // Large faint watermark plus a clear corner label, so it can never pass as a real receipt.
    page.drawText("SAMPLE", {
      x: 150,
      y: 330,
      size: 120,
      font: bold,
      color: rgb(0.85, 0.85, 0.85),
      rotate: degrees(35),
      opacity: 0.6,
    });
    const label = "SAMPLE";
    const w = bold.widthOfTextAtSize(label, 14);
    page.drawRectangle({
      x: right - w - 16,
      y: 805,
      width: w + 16,
      height: 26,
      borderColor: rgb(0.75, 0.1, 0.1),
      borderWidth: 1.5,
    });
    page.drawText(label, { x: right - w - 8, y: 813, size: 14, font: bold, color: rgb(0.75, 0.1, 0.1) });
  }

  return pdf.save();
}
