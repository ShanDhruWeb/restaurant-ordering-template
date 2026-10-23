import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { buildPrivacy } from "@/content/policies";
import { getIdentity } from "@/lib/identity";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("/privacy");

export default function Page() {
  return <PolicyPage policy={buildPrivacy(getIdentity())} />;
}
