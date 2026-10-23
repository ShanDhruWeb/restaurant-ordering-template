// Small fetch wrapper for the browser. Always JSON, never throws on HTTP errors:
// returns { ok, status, data } so callers can show the right message.
export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T & { error?: string; code?: string };
  networkError?: boolean;
}

export async function api<T = Record<string, unknown>>(
  url: string,
  init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
      cache: "no-store",
    });
    let data: unknown = {};
    try {
      data = await res.json();
    } catch {
      /* empty or non-JSON body */
    }
    return { ok: res.ok, status: res.status, data: data as ApiResult<T>["data"] };
  } catch {
    return { ok: false, status: 0, data: {} as ApiResult<T>["data"], networkError: true };
  }
}
