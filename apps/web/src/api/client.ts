import { ApiResponse } from '@sciclub/shared';

const API_BASE = '/api';

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Token persistant pour immuniser l'auth contre les blocages de cookies tiers/cross-site
  const token = localStorage.getItem('cortex_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
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
