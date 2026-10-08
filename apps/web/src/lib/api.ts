import { RepositoryError } from './repository';

/** Calls the local API with JSON and throws its error message, keeping the status for 409 conflicts. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
  if (!response.ok)
    throw new RepositoryError(data?.error ?? 'O servidor local não respondeu. Rode pnpm run dev.', response.status);
  return data as T;
}
