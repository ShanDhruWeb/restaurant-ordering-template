import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { config } from "@/config";
import { adminStrings } from "@/content/adminStrings";
import { currentAdmin } from "@/server/admin/guard";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: adminStrings.login.title };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  if (await currentAdmin()) redirect("/admin");
  const { expired } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <p className="text-sm font-semibold text-muted">{config.restaurant.name}</p>
      <h1 className="mt-1 text-3xl font-bold">{adminStrings.login.title}</h1>
      {expired && (
        <p role="status" className="mt-4 rounded-card bg-tint px-3 py-2 text-sm">
          {adminStrings.sessionExpired}
        </p>
      )}
      <LoginForm />
      <p className="mt-6 text-xs text-muted">{adminStrings.login.noAccount}</p>
    </main>
  );
}
