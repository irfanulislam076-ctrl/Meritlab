export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(/\/+$/, "");

export type User = { id: string; name: string; mobile: string; email: string; role: string; emailVerified: boolean };
export type Course = {
  _id: string; title: string; slug: string; description: string; priceBdt: number;
  freeDays: number; durationDays: number; startDate: string;
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: { code?: string; email?: string }) {
    super(message);
  }
}

// The access token lives in memory only. The refresh token is an httpOnly cookie set by the backend.
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };

async function request(path: string, method: string, body?: unknown) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

export async function refreshSession(): Promise<{ user: User; accessToken: string } | null> {
  try {
    const { res, json } = await request("/auth/refresh", "POST");
    if (!res.ok) return null;
    setAccessToken(json.data.accessToken);
    return json.data;
  } catch {
    return null;
  }
}

export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  let attempt: Awaited<ReturnType<typeof request>>;
  try {
    attempt = await request(path, method, body);
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your internet or try again.");
  }
  // Expired access token on a protected call: refresh once and retry.
  if (attempt.res.status === 401 && accessToken && !path.startsWith("/auth/")) {
    if (await refreshSession()) attempt = await request(path, method, body);
  }
  if (!attempt.res.ok) {
    throw new ApiError(attempt.res.status, attempt.json?.message ?? "Something went wrong", attempt.json?.details);
  }
  return attempt.json.data as T;
}

/** Multipart upload (image or pdf) to the backend. Returns { url, publicId }. */
export async function uploadFile(path: string, file: File): Promise<{ url: string; publicId: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api${path}`, { method: "POST", credentials: "include", headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json?.message ?? "Upload failed");
  return json.data;
}
