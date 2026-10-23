import Link from "next/link";
import { config } from "@/config";
import { strings } from "@/content/strings";
import type { Policy } from "@/content/policies";

export function PolicyPage({ policy }: { policy: Policy }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="-ml-2 inline-flex h-11 items-center px-2 font-semibold text-primary">
        ← {strings.pages.goHome}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{policy.title}</h1>
      {!config.legal.policiesReviewed && (
        <p
          role="note"
          className="mt-4 rounded-card border-2 border-dashed border-line bg-tint px-3 py-2 text-sm font-semibold"
        >
          {strings.pages.templateNotice}
        </p>
      )}
      {policy.sections.map((s) => (
        <section key={s.heading} className="mt-6">
          <h2 className="text-xl font-bold">{s.heading}</h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="mt-2 leading-relaxed">
              {p}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
