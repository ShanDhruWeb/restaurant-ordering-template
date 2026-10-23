"use client";

import Link from "next/link";
import { strings } from "@/content/strings";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">{strings.pages.errorTitle}</h1>
      <p className="mt-2 text-muted">{strings.pages.errorBody}</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-12 items-center rounded-pill bg-primary px-6 font-semibold text-on-primary"
        >
          {strings.common.retry}
        </button>
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-pill border border-line px-6 font-semibold"
        >
          {strings.pages.goHome}
        </Link>
      </div>
    </main>
  );
}
