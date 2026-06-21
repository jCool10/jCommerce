import { getSession } from 'next-auth/react';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

type FetchOptions = Omit<RequestInit, 'body'> & { body?: unknown };

export class ApiError extends Error {
  constructor(public status: number, message: string, public payload?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const session = await getSession();
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json');
  if (session?.accessToken) headers.set('authorization', `Bearer ${session.accessToken}`);

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const msg = (json && typeof json === 'object' && 'message' in json
      ? String((json as { message: unknown }).message)
      : res.statusText) || 'request failed';
    throw new ApiError(res.status, msg, json);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
};
