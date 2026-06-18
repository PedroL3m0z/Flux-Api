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

export type EngineKey = 'gramjs' | 'telegraf'

export type InstanceStatus =
  | 'new'
  | 'connecting'
  | 'awaiting_qr'
  | 'password_required'
  | 'authorized'
  | 'disconnected'
  | 'error'

export interface TelegramInstance {
  id: string
  label: string
  engine: EngineKey
  status: InstanceStatus
  username?: string
  createdAt: string
}

export interface TelegramMe {
  id: string
  username?: string
  firstName?: string
}

export type QrLoginEvent =
  | { type: 'qr'; url: string; expires: number }
  | { type: 'password_required' }
  | { type: 'authorized'; me: TelegramMe }
  | { type: 'error'; message: string }

export type PeerType = 'user' | 'group' | 'channel'

export interface ChatView {
  id: string
  tgPeerId: string
  type: PeerType
  title?: string
  username?: string
  lastMessageAt?: string
}

export interface MessageView {
  id: string
  chatId: string
  tgMessageId: string
  text?: string
  outgoing: boolean
  date: string
  senderId?: string
}

export interface MessagePage {
  items: MessageView[]
  nextCursor: string | null
}

export interface TelegramSettings {
  apiId?: string
  hasApiHash: boolean
}

export interface SystemStats {
  uptimeSeconds: number
  instances: {
    total: number
    authorized: number
    connected: number
  }
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

  telegramInstances: () => request<TelegramInstance[]>('/telegram/instances'),
  createInstance: (input: {
    label: string
    engine?: EngineKey
    apiId?: string
    apiHash?: string
  }) =>
    request<TelegramInstance>('/telegram/instances', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteInstance: (id: string) =>
    request<void>(`/telegram/instances/${id}`, { method: 'DELETE' }),
  submitQrPassword: (id: string, password: string) =>
    request<{ ok: boolean }>(`/telegram/instances/${id}/login/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  // Server-sent stream of the QR login flow; caller subscribes and closes it.
  qrLoginStream: (id: string) =>
    new EventSource(`/telegram/instances/${id}/login/qr`),

  instanceChats: (id: string) =>
    request<ChatView[]>(`/telegram/instances/${id}/chats`),
  chatMessages: (
    id: string,
    chatId: string,
    opts: { cursor?: string; limit?: number } = {},
  ) => {
    const qs = new URLSearchParams()
    if (opts.cursor) qs.set('cursor', opts.cursor)
    if (opts.limit) qs.set('limit', String(opts.limit))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return request<MessagePage>(
      `/telegram/instances/${id}/chats/${chatId}/messages${suffix}`,
    )
  },
  sendChatMessage: (id: string, chatId: string, text: string) =>
    request<MessageView>(
      `/telegram/instances/${id}/chats/${chatId}/messages`,
      { method: 'POST', body: JSON.stringify({ text }) },
    ),
  // Realtime stream of newly ingested messages for an instance.
  messagesStream: (id: string) =>
    new EventSource(`/telegram/instances/${id}/messages/stream`),

  stats: () => request<SystemStats>('/telegram/stats'),
  getSettings: () => request<TelegramSettings>('/telegram/settings'),
  updateSettings: (body: { apiId?: string; apiHash?: string }) =>
    request<TelegramSettings>('/telegram/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
}
