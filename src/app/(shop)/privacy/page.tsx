import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { privacy } from "@/content/policies";

export const metadata: Metadata = { title: privacy.title };

export default function Page() {
  return <PolicyPage policy={privacy} />;
}
