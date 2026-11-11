"use client";

import { toast } from "sonner";

export class ClientError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) {
    super(message);
  }
}

/** JSON fetch for the app's own API. Throws ClientError with field errors. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.form ? undefined : { "Content-Type": "application/json" },
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    credentials: "same-origin",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    toast.error("Your session has ended. Please sign in again.");
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ClientError(data.error ?? "Request failed.", res.status, data.fields ?? data.details?.fields ?? {});
  return data as T;
}

/** Runs a mutation with a toast for success or failure. Returns undefined on failure. */
export async function run<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
  try {
    const r = await fn();
    if (success) toast.success(success);
    return r;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Something went wrong.");
    return undefined;
  }
}

/** Downloads a file from a GET endpoint (used for PDF / Excel exports). */
export async function download(url: string) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? "Export failed.");
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "export";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
