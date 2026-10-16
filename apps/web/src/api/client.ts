import { ApiResponse } from '@sciclub/shared';

const API_BASE = '/api';

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  const data: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    error: `Réponse serveur invalide (Code HTTP ${response.status})`
  }));

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Erreur requête (${response.status})`);
  }

  return data.data as T;
}
