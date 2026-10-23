"use client";

// Admin calls: like api(), but a 401 sends staff back to the login page.
import { api, type ApiResult } from "./api";

export async function adminApi<T = Record<string, unknown>>(
  url: string,
  init: Parameters<typeof api>[1] = {},
): Promise<ApiResult<T>> {
  const res = await api<T>(url, init);
  // A full page load (not the router) so every piece of admin state is dropped.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate hard reload
  if (res.status === 401) window.location.assign("/admin/login?expired=1");
  return res;
}
