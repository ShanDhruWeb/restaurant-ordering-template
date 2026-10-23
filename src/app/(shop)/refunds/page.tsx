import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { refunds } from "@/content/policies";

export const metadata: Metadata = { title: refunds.title };

export default function Page() {
  return <PolicyPage policy={refunds} />;
}
