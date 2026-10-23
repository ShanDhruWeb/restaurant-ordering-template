import Link from "next/link";
import { strings } from "@/content/strings";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-heading text-6xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-2xl font-bold">{strings.pages.notFoundTitle}</h1>
      <p className="mt-2 text-muted">{strings.pages.notFoundBody}</p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center rounded-pill bg-primary px-6 font-semibold text-on-primary"
      >
        {strings.pages.goHome}
      </Link>
    </main>
  );
}
