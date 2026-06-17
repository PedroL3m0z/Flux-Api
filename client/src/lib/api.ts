export interface SafeUser {
  id: string
  email: string
  username: string
}

export interface Credentials {
  username: string
  password: string
}

export interface RegisterPayload {
  email: string
  username: string
  password: string
}

export interface HealthResult {
  status: string
  info?: Record<string, { status: string }>
}

export interface UserListItem {
  id: string
  email: string
  username: string
  createdAt: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  })

  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : null

  if (!res.ok) {
    const message =
      (data as { message?: string | string[]; error?: string } | null)
        ?.message ?? res.statusText
    throw new Error(Array.isArray(message) ? message.join(', ') : message)
  }

  return data as T
}

export const api = {
  register: (body: RegisterPayload) =>
    request<SafeUser>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: Credentials) =>
    request<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<SafeUser>('/auth/me'),
  users: () => request<UserListItem[]>('/users'),
  apiKeyCheck: (key: string) =>
    request<{ ok: boolean; via: string }>('/auth/api-key-check', {
      headers: { 'x-api-key': key },
    }),
  health: () => request<HealthResult>('/health'),
}
