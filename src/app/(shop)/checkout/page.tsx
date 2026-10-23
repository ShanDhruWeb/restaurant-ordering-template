import type { Metadata } from "next";
import { config, tableLabels } from "@/config";
import { getIdentity } from "@/lib/identity";
import { strings } from "@/content/strings";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: strings.checkout.title, robots: { index: false } };

export default function CheckoutPage() {
  const o = config.ordering;
  const id = getIdentity();
  return (
    <CheckoutForm
      types={o.types}
      tables={tableLabels}
      requirePhone={o.requirePhone}
      notesEnabled={o.notesEnabled}
      taxNote={o.taxNote}
      maxQtyPerItem={o.maxQtyPerItem}
      seller={{ legalName: id.legalName, address: id.operatingAddressText, phone: id.phone }}
    />
  );
}
