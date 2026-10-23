import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { buildTerms } from "@/content/policies";
import { getIdentity } from "@/lib/identity";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("/terms");

export default function Page() {
  return <PolicyPage policy={buildTerms(getIdentity())} />;
}
