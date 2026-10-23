import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { buildRefunds } from "@/content/policies";
import { getIdentity } from "@/lib/identity";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("/refunds");

export default function Page() {
  return <PolicyPage policy={buildRefunds(getIdentity())} />;
}
