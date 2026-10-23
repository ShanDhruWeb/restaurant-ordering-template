import { strings } from "@/content/strings";
import { getIdentity, todayHoursText } from "@/lib/identity";

/** Server-rendered top section of the home page, above the menu. Kept compact so the menu stays close. */
export function HomeIntro() {
  const id = getIdentity();
  const t = strings.home;
  return (
    <section aria-labelledby="intro-h" className="px-4 pb-4">
      <h2 id="intro-h" className="sr-only">
        {id.tradeName}
      </h2>
      <p className="leading-relaxed">{id.description}</p>
      <p className="mt-2 text-sm text-muted">
        {id.operatingAddressText}. {todayHoursText(id)}.
      </p>
      <a
        href="#menu"
        className="mt-3 inline-flex h-12 items-center justify-center rounded-pill bg-primary px-6 font-semibold text-on-primary"
      >
        {t.orderNow}
      </a>
      <div className="mt-4 rounded-card border border-line bg-surface p-3">
        <h3 className="text-sm font-bold">{t.howTitle}</h3>
        <ol className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {t.how.map((step, i) => (
            <li key={step} className="flex gap-2">
              <span aria-hidden="true" className="font-bold text-primary">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">
          {t.paymentMethods} {t.razorpay}
        </p>
      </div>
    </section>
  );
}
