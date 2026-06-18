<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, FileText, Paperclip, Send } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import {
  api,
  type ChatView,
  type MessageView,
} from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const instanceId = route.params.id as string

const chats = ref<ChatView[]>([])
const selected = ref<ChatView | null>(null)
const messages = ref<MessageView[]>([])
const sendText = ref('')
const loadingChats = ref(false)
const loadingMessages = ref(false)
const loadingMore = ref(false)
const cursor = ref<string | null>(null)
const sending = ref(false)
const scroller = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
let stream: EventSource | null = null

// Avatar URLs that failed to load (no photo / not connected): fall back to initials.
const brokenAvatars = reactive(new Set<string>())
function avatarBroken(url: string) {
  brokenAvatars.add(url)
}

function initials(name?: string): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function chatName(chat: ChatView): string {
  return chat.title || chat.username || chat.tgPeerId
}

const headerName = computed(() => (selected.value ? chatName(selected.value) : ''))

async function loadChats() {
  loadingChats.value = true
  try {
    chats.value = await api.instanceChats(instanceId)
  } finally {
    loadingChats.value = false
  }
}

async function scrollToBottom() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

async function selectChat(chat: ChatView) {
  selected.value = chat
  loadingMessages.value = true
  messages.value = []
  cursor.value = null
  try {
    const page = await api.chatMessages(instanceId, chat.id, { limit: 50 })
    messages.value = [...page.items].reverse() // API: newest first → show chronological
    cursor.value = page.nextCursor
    await scrollToBottom()
  } finally {
    loadingMessages.value = false
  }
}

// Scroll near the top → fetch the next (older) page and prepend it, keeping the
// viewport anchored on the message the user was reading.
async function loadOlder() {
  if (!selected.value || !cursor.value || loadingMore.value) return
  loadingMore.value = true
  const el = scroller.value
  const prevHeight = el?.scrollHeight ?? 0
  try {
    const page = await api.chatMessages(instanceId, selected.value.id, {
      cursor: cursor.value,
      limit: 50,
    })
    const older = [...page.items]
      .reverse()
      .filter((m) => !messages.value.some((x) => x.id === m.id))
    messages.value = [...older, ...messages.value]
    cursor.value = page.nextCursor
    await nextTick()
    if (el) el.scrollTop = el.scrollHeight - prevHeight
  } finally {
    loadingMore.value = false
  }
}

function onScroll() {
  const el = scroller.value
  if (el && el.scrollTop <= 48 && cursor.value && !loadingMore.value) {
    void loadOlder()
  }
}

async function onSend() {
  const text = sendText.value.trim()
  if (!text || !selected.value || sending.value) return
  sending.value = true
  try {
    const msg = await api.sendChatMessage(instanceId, selected.value.id, text)
    sendText.value = ''
    appendMessage(msg)
  } finally {
    sending.value = false
  }
}

function pickFile() {
  fileInput.value?.click()
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-picking the same file
  if (!file || !selected.value || sending.value) return
  sending.value = true
  try {
    const caption = sendText.value.trim() || undefined
    const msg = await api.sendChatMedia(
      instanceId,
      selected.value.id,
      file,
      caption,
    )
    sendText.value = ''
    appendMessage(msg)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('chats.sendFailed'))
  } finally {
    sending.value = false
  }
}

function appendMessage(msg: MessageView) {
  if (messages.value.some((m) => m.id === msg.id)) return
  messages.value.push(msg)
  void scrollToBottom()
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Incoming message in a group/channel → reserve the avatar gutter (Telegram style).
function isGroupIncoming(msg: MessageView): boolean {
  return !msg.outgoing && !!selected.value && selected.value.type !== 'user'
}

// First message of a consecutive run from the same sender: where avatar + name show.
function runStart(index: number): boolean {
  const cur = messages.value[index]
  const prev = messages.value[index - 1]
  if (!prev) return true
  return prev.outgoing !== cur.outgoing || prev.sender?.id !== cur.sender?.id
}

function mediaUrl(msg: MessageView): string {
  return api.messageMediaUrl(instanceId, msg.chatId, msg.tgMessageId)
}

onMounted(async () => {
  await loadChats()
  stream = api.messagesStream(instanceId)
  stream.onmessage = (ev: MessageEvent<string>) => {
    const msg = JSON.parse(ev.data) as MessageView
    if (selected.value && msg.chatId === selected.value.id) appendMessage(msg)
    void loadChats()
  }
})

onUnmounted(() => stream?.close())
</script>

<template>
  <div class="flex h-[calc(100vh-7rem)] flex-col">
    <div class="mb-3 flex items-center gap-2">
      <Button variant="ghost" size="icon" @click="router.push({ name: 'instances' })">
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <h1 class="text-xl font-semibold tracking-tight">{{ t('chats.title') }}</h1>
    </div>

    <div class="flex min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
      <!-- Chat list -->
      <aside class="w-72 shrink-0 overflow-y-auto border-r">
        <p v-if="loadingChats" class="p-4 text-sm text-muted-foreground">
          {{ t('common.loading') }}
        </p>
        <p v-else-if="!chats.length" class="p-4 text-sm text-muted-foreground">
          {{ t('chats.empty') }}
        </p>
        <button
          v-for="chat in chats"
          :key="chat.id"
          class="flex w-full items-center gap-3 border-b px-3 py-3 text-left hover:bg-accent"
          :class="selected?.id === chat.id ? 'bg-accent' : ''"
          @click="selectChat(chat)"
        >
          <img
            v-if="chat.hasPhoto && !brokenAvatars.has(api.chatPhotoUrl(instanceId, chat.id))"
            :src="api.chatPhotoUrl(instanceId, chat.id)"
            class="h-10 w-10 shrink-0 rounded-full object-cover"
            alt=""
            @error="avatarBroken(api.chatPhotoUrl(instanceId, chat.id))"
          />
          <span
            v-else
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
          >
            {{ initials(chatName(chat)) }}
          </span>
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-sm font-medium">{{ chatName(chat) }}</span>
            <span v-if="chat.username" class="truncate text-xs text-muted-foreground">
              @{{ chat.username }}
            </span>
            <span v-else class="text-xs text-muted-foreground">{{ chat.type }}</span>
          </span>
        </button>
      </aside>

      <!-- Conversation -->
      <section class="flex min-w-0 flex-1 flex-col">
        <div
          v-if="!selected"
          class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
        >
          {{ t('chats.selectPrompt') }}
        </div>
        <template v-else>
          <header class="flex items-center gap-3 border-b px-4 py-3">
            <img
              v-if="selected.hasPhoto && !brokenAvatars.has(api.chatPhotoUrl(instanceId, selected.id))"
              :src="api.chatPhotoUrl(instanceId, selected.id)"
              class="h-9 w-9 rounded-full object-cover"
              alt=""
              @error="avatarBroken(api.chatPhotoUrl(instanceId, selected.id))"
            />
            <span
              v-else
              class="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
            >
              {{ initials(headerName) }}
            </span>
            <span class="flex flex-col">
              <span class="text-sm font-medium">{{ headerName }}</span>
              <span v-if="selected.username" class="text-xs text-muted-foreground">
                @{{ selected.username }}
              </span>
            </span>
          </header>
          <div
            ref="scroller"
            class="flex-1 space-y-2 overflow-y-auto p-4"
            @scroll="onScroll"
          >
            <p v-if="loadingMessages" class="text-center text-sm text-muted-foreground">
              {{ t('common.loading') }}
            </p>
            <p
              v-else-if="loadingMore"
              class="text-center text-xs text-muted-foreground"
            >
              {{ t('common.loading') }}
            </p>
            <div
              v-for="(msg, i) in messages"
              :key="msg.id"
              class="flex items-end gap-2"
              :class="msg.outgoing ? 'justify-end' : 'justify-start'"
            >
              <!-- Avatar gutter (group/channel incoming): avatar at run start, spacer otherwise -->
              <template v-if="isGroupIncoming(msg)">
                <template v-if="runStart(i) && msg.sender">
                  <img
                    v-if="msg.sender.hasPhoto && !brokenAvatars.has(api.contactPhotoUrl(instanceId, msg.sender.id))"
                    :src="api.contactPhotoUrl(instanceId, msg.sender.id)"
                    class="h-7 w-7 shrink-0 rounded-full object-cover"
                    alt=""
                    @error="avatarBroken(api.contactPhotoUrl(instanceId, msg.sender.id))"
                  />
                  <span
                    v-else
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
                  >
                    {{ initials(msg.sender.name) }}
                  </span>
                </template>
                <span v-else class="h-7 w-7 shrink-0" />
              </template>

              <div
                class="max-w-[70%] rounded-lg px-3 py-2 text-sm"
                :class="
                  msg.outgoing
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                "
              >
                <p
                  v-if="isGroupIncoming(msg) && runStart(i) && msg.sender"
                  class="mb-1 text-xs font-semibold text-primary"
                >
                  {{ msg.sender.name || ('@' + (msg.sender.username ?? '')) }}
                </p>

                <!-- Media -->
                <template v-if="msg.media">
                  <!-- Sticker: small, transparent, no frame -->
                  <img
                    v-if="msg.media.type === 'sticker'"
                    :src="mediaUrl(msg)"
                    loading="lazy"
                    class="mb-1 h-32 w-32 object-contain"
                    alt=""
                  />
                  <!-- Photo: uniform thumbnail, click to open full size -->
                  <a
                    v-else-if="msg.media.type === 'photo'"
                    :href="mediaUrl(msg)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mb-1 block"
                  >
                    <img
                      :src="mediaUrl(msg)"
                      loading="lazy"
                      class="h-48 w-64 cursor-pointer rounded-lg border border-border/50 object-cover"
                      alt=""
                    />
                  </a>
                  <video
                    v-else-if="msg.media.type === 'video'"
                    :src="mediaUrl(msg)"
                    controls
                    class="mb-1 h-48 w-64 rounded-lg border border-border/50 object-cover"
                  />
                  <audio
                    v-else-if="msg.media.type === 'audio'"
                    :src="mediaUrl(msg)"
                    controls
                    class="mb-1 w-64"
                  />
                  <a
                    v-else
                    :href="mediaUrl(msg)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mb-1 flex w-64 items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                  >
                    <FileText class="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span class="truncate text-sm">{{ msg.media.fileName || t('chats.attachment') }}</span>
                  </a>
                </template>

                <p v-if="msg.text" class="whitespace-pre-wrap break-words">{{ msg.text }}</p>
                <p class="mt-1 text-right text-[10px] opacity-70">
                  {{ fmtTime(msg.date) }}
                </p>
              </div>
            </div>
          </div>
          <form class="flex gap-2 border-t p-3" @submit.prevent="onSend">
            <input
              ref="fileInput"
              type="file"
              class="hidden"
              @change="onFilePicked"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              :disabled="sending"
              :title="t('chats.attach')"
              @click="pickFile"
            >
              <Paperclip class="h-4 w-4" />
            </Button>
            <Input
              v-model="sendText"
              :placeholder="t('chats.placeholder')"
              class="flex-1"
            />
            <Button type="submit" size="icon" :disabled="sending">
              <Send class="h-4 w-4" />
            </Button>
          </form>
        </template>
      </section>
    </div>
  </div>
</template>
