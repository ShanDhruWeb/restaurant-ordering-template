import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { buildShipping } from "@/content/policies";
import { getIdentity } from "@/lib/identity";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("/shipping");

export default function Page() {
  return <PolicyPage policy={buildShipping(getIdentity())} />;
}
