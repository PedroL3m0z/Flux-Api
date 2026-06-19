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
  firstName?: string
  username?: string
  phone?: string
  createdAt: string
}

export interface InstanceInfo extends TelegramInstance {
  connected: boolean
  uptimeSeconds: number | null
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
  hasPhoto: boolean
  lastMessageAt?: string
}

export type MediaType =
  | 'none'
  | 'photo'
  | 'video'
  | 'document'
  | 'audio'
  | 'sticker'
  | 'other'

export interface MediaView {
  type: MediaType
  mimeType?: string
  fileName?: string
  width?: number
  height?: number
  duration?: number
}

export interface MessageSenderView {
  id: string
  name?: string
  username?: string
  hasPhoto: boolean
}

export interface MessageView {
  id: string
  chatId: string
  tgMessageId: string
  text?: string
  outgoing: boolean
  date: string
  senderId?: string
  sender?: MessageSenderView
  media?: MediaView
}

export interface MessagePage {
  items: MessageView[]
  nextCursor: string | null
}

export interface TelegramSettings {
  apiId?: string
  hasApiHash: boolean
}

export const WEBHOOK_EVENT_TYPES = [
  'session.status',
  'message.new',
  'message.edited',
  'message.deleted',
  'message.read',
  'message.reaction',
] as const

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]

export interface Webhook {
  id: string
  name: string
  url: string
  active: boolean
  events: string[]
  instanceIds: string[]
  createdAt: string
  updatedAt: string
}

export interface WebhookWithSecret extends Webhook {
  secret: string
}

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'dead'

export interface WebhookDelivery {
  id: string
  webhookId: string
  instanceId?: string
  event: string
  status: WebhookDeliveryStatus
  attempts: number
  statusCode?: number
  lastError?: string
  createdAt: string
  deliveredAt?: string
}

export interface SystemStats {
  uptimeSeconds: number
  instances: {
    total: number
    authorized: number
    connected: number
  }
}

// --- API key (required on every request; entered after login) ---

const API_KEY_STORAGE = 'flux-api-key'
let apiKey = localStorage.getItem(API_KEY_STORAGE) ?? ''

export function setApiKey(key: string): void {
  apiKey = key
  localStorage.setItem(API_KEY_STORAGE, key)
}

export function clearApiKey(): void {
  apiKey = ''
  localStorage.removeItem(API_KEY_STORAGE)
}

export function hasApiKey(): boolean {
  return apiKey.length > 0
}

/** Appends the API key as a query param (for SSE/img URLs that can't set headers). */
function withKey(url: string): string {
  if (!apiKey) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}apiKey=${encodeURIComponent(apiKey)}`
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      ...(options.headers ?? {}),
    },
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
  instanceInfo: (id: string) =>
    request<InstanceInfo>(`/telegram/instances/${id}/info`),
  startInstance: (id: string) =>
    request<TelegramInstance>(`/telegram/instances/${id}/start`, {
      method: 'POST',
    }),
  stopInstance: (id: string) =>
    request<{ ok: boolean }>(`/telegram/instances/${id}/stop`, {
      method: 'POST',
    }),
  submitQrPassword: (id: string, password: string) =>
    request<{ ok: boolean }>(`/telegram/instances/${id}/login/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  // Server-sent stream of the QR login flow; caller subscribes and closes it.
  qrLoginStream: (id: string) =>
    new EventSource(withKey(`/telegram/instances/${id}/login/qr`)),

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
  sendChatMedia: async (
    id: string,
    chatId: string,
    file: File,
    caption?: string,
  ): Promise<MessageView> => {
    const form = new FormData()
    form.append('file', file)
    if (caption) form.append('caption', caption)
    // Multipart: let the browser set Content-Type (boundary); keep the API key.
    const res = await fetch(
      `/telegram/instances/${id}/chats/${chatId}/media`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { ...(apiKey ? { 'x-api-key': apiKey } : {}) },
        body: form,
      },
    )
    const text = await res.text()
    const data: unknown = text ? JSON.parse(text) : null
    if (!res.ok) {
      const message =
        (data as { message?: string | string[] } | null)?.message ??
        res.statusText
      throw new Error(Array.isArray(message) ? message.join(', ') : message)
    }
    return data as MessageView
  },
  // Realtime stream of newly ingested messages for an instance.
  messagesStream: (id: string) =>
    new EventSource(withKey(`/telegram/instances/${id}/messages/stream`)),

  // Byte URLs (used directly as <img>/<a> sources; auth via cookie + key query).
  chatPhotoUrl: (id: string, chatId: string) =>
    withKey(`/telegram/instances/${id}/chats/${chatId}/photo`),
  contactPhotoUrl: (id: string, contactId: string) =>
    withKey(`/telegram/instances/${id}/contacts/${contactId}/photo`),
  messageMediaUrl: (id: string, chatId: string, tgMessageId: string) =>
    withKey(`/telegram/instances/${id}/chats/${chatId}/messages/${tgMessageId}/media`),

  // --- Webhooks ---
  webhooks: () => request<Webhook[]>('/webhooks'),
  createWebhook: (body: {
    name: string
    url: string
    events: string[]
    instanceIds?: string[]
  }) =>
    request<WebhookWithSecret>('/webhooks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateWebhook: (
    id: string,
    body: {
      name?: string
      url?: string
      active?: boolean
      events?: string[]
    },
  ) =>
    request<Webhook>(`/webhooks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteWebhook: (id: string) =>
    request<void>(`/webhooks/${id}`, { method: 'DELETE' }),
  regenerateWebhookSecret: (id: string) =>
    request<WebhookWithSecret>(`/webhooks/${id}/regenerate-secret`, {
      method: 'POST',
    }),
  linkWebhookInstance: (id: string, instanceId: string) =>
    request<Webhook>(`/webhooks/${id}/instances/${instanceId}`, {
      method: 'POST',
    }),
  unlinkWebhookInstance: (id: string, instanceId: string) =>
    request<Webhook>(`/webhooks/${id}/instances/${instanceId}`, {
      method: 'DELETE',
    }),
  webhookDeliveries: (id: string) =>
    request<WebhookDelivery[]>(`/webhooks/${id}/deliveries`),
  resendWebhookDelivery: (deliveryId: string) =>
    request<WebhookDelivery>(`/webhooks/deliveries/${deliveryId}/resend`, {
      method: 'POST',
    }),

  stats: () => request<SystemStats>('/telegram/stats'),
  getSettings: () => request<TelegramSettings>('/telegram/settings'),
  updateSettings: (body: { apiId?: string; apiHash?: string }) =>
    request<TelegramSettings>('/telegram/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
}
