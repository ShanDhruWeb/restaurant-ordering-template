import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { terms } from "@/content/policies";

export const metadata: Metadata = { title: terms.title };

export default function Page() {
  return <PolicyPage policy={terms} />;
}
