import { store } from '../store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function buildApiUrl(path) {
  if (!path) {
    return API_BASE_URL;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function apiFetch(path, options = {}) {
  const { headers, ...rest } = options;
  const token = store.getState().auth?.jwtToken;

  return fetch(buildApiUrl(path), {
    credentials: 'include',
    ...rest,
    headers: {
      ...(token && !headers?.Authorization
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...headers,
    },
  });
}
