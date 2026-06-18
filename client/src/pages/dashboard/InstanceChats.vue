<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Send } from 'lucide-vue-next'
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
const sending = ref(false)
const scroller = ref<HTMLElement | null>(null)
let stream: EventSource | null = null

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
  try {
    const page = await api.chatMessages(instanceId, chat.id, { limit: 50 })
    messages.value = [...page.items].reverse() // API: newest first → show chronological
    await scrollToBottom()
  } finally {
    loadingMessages.value = false
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
      <aside class="w-64 shrink-0 overflow-y-auto border-r">
        <p v-if="loadingChats" class="p-4 text-sm text-muted-foreground">
          {{ t('common.loading') }}
        </p>
        <p v-else-if="!chats.length" class="p-4 text-sm text-muted-foreground">
          {{ t('chats.empty') }}
        </p>
        <button
          v-for="chat in chats"
          :key="chat.id"
          class="flex w-full flex-col border-b px-4 py-3 text-left hover:bg-accent"
          :class="selected?.id === chat.id ? 'bg-accent' : ''"
          @click="selectChat(chat)"
        >
          <span class="truncate text-sm font-medium">
            {{ chat.title || chat.username || chat.tgPeerId }}
          </span>
          <span class="text-xs text-muted-foreground">{{ chat.type }}</span>
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
          <header class="border-b px-4 py-3 text-sm font-medium">
            {{ selected.title || selected.username || selected.tgPeerId }}
          </header>
          <div ref="scroller" class="flex-1 space-y-2 overflow-y-auto p-4">
            <p v-if="loadingMessages" class="text-center text-sm text-muted-foreground">
              {{ t('common.loading') }}
            </p>
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="flex"
              :class="msg.outgoing ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[70%] rounded-lg px-3 py-2 text-sm"
                :class="
                  msg.outgoing
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                "
              >
                <p class="whitespace-pre-wrap break-words">{{ msg.text }}</p>
                <p class="mt-1 text-right text-[10px] opacity-70">
                  {{ fmtTime(msg.date) }}
                </p>
              </div>
            </div>
          </div>
          <form class="flex gap-2 border-t p-3" @submit.prevent="onSend">
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
