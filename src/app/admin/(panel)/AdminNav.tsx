"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminStrings } from "@/content/adminStrings";
import { api } from "@/lib/client/api";

const LINKS = [
  { href: "/admin", label: adminStrings.nav.orders },
  { href: "/admin/menu", label: adminStrings.nav.menu },
  { href: "/admin/history", label: adminStrings.nav.history },
  { href: "/admin/payments", label: adminStrings.nav.payments },
  { href: "/admin/qr", label: adminStrings.nav.qr },
  { href: "/admin/settings", label: adminStrings.nav.settings },
];

export function AdminNav({ restaurantName, email }: { restaurantName: string; email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = async () => {
    await api("/api/admin/logout", { method: "POST", body: {} });
    router.replace("/admin/login");
    router.refresh();
  };
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 sm:px-4">
        <span className="hidden py-3 font-heading text-lg font-bold sm:inline">{restaurantName}</span>
        <nav aria-label={adminStrings.nav.mainNav} className="flex-1 overflow-x-auto [scrollbar-width:none]">
          <ul className="flex">
            {LINKS.map((l) => {
              const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex h-14 items-center border-b-4 px-3 font-semibold whitespace-nowrap ${
                      active ? "border-primary text-ink" : "border-transparent text-muted"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <button
          type="button"
          onClick={logout}
          title={email}
          className="h-11 shrink-0 rounded-card border border-line px-3 text-sm font-semibold"
        >
          {adminStrings.nav.logout}
        </button>
      </div>
    </header>
  );
}
