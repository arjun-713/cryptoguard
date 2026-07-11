const ABSOLUTE_URL_RE = /^https?:\/\//i;

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function apiUrl(path: string): string {
  if (ABSOLUTE_URL_RE.test(path)) {
    return path;
  }

  const base = trimTrailingSlash(import.meta.env.VITE_API_URL || '');
  if (!base) {
    return path;
  }

  return `${base}${path}`;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
