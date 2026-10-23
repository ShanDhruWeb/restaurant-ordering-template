"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { adminStrings } from "@/content/adminStrings";
import { strings } from "@/content/strings";
import { api } from "@/lib/client/api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = adminStrings.login;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await api("/api/admin/login", { method: "POST", body: { email, password } });
    if (res.ok) {
      router.replace("/admin");
      router.refresh();
      return;
    }
    setBusy(false);
    setPassword("");
    if (res.networkError) setError(strings.checkout.networkError);
    else if (res.status === 429) setError(strings.checkout.rateLimited);
    else setError(t.failed);
  };

  const field = "mt-1 h-14 w-full rounded-card border-2 border-line bg-surface px-4 text-lg";
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block">
        <span className="font-semibold">{t.email}</span>
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
          required
        />
      </label>
      <label className="block">
        <span className="font-semibold">{t.password}</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
          required
        />
      </label>
      {error && (
        <p role="alert" className="rounded-card bg-danger px-3 py-2 font-semibold text-surface">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-14 w-full rounded-card bg-primary text-lg font-bold text-on-primary disabled:opacity-60"
      >
        {busy ? t.submitting : t.submit}
      </button>
    </form>
  );
}
