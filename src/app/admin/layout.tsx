import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getIdentity } from "@/lib/identity";

// Staff pages are never indexed (also sent as an X-Robots-Tag header in next.config.ts).
export const metadata: Metadata = {
  title: { default: `Admin | ${getIdentity().shortName}`, template: `%s | Admin` },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-bg">{children}</div>;
}
