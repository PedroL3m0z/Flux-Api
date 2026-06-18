<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import QRCode from 'qrcode'
import { ChevronDown, MessageSquare, Plus, Server, Trash2, X } from 'lucide-vue-next'
import {
  api,
  type EngineKey,
  type InstanceStatus,
  type QrLoginEvent,
  type TelegramInstance,
} from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardDescription from '@/components/ui/CardDescription.vue'
import CardContent from '@/components/ui/CardContent.vue'

const { t, locale } = useI18n()
const router = useRouter()

const engines: { key: EngineKey; label: string; disabled?: boolean }[] = [
  { key: 'gramjs', label: 'GramJS' },
  { key: 'telegraf', label: 'Telegraf', disabled: true },
]

const instances = ref<TelegramInstance[]>([])
const loading = ref(false)
const listError = ref('')

async function loadInstances() {
  loading.value = true
  listError.value = ''
  try {
    instances.value = await api.telegramInstances()
  } catch (e) {
    listError.value = e instanceof Error ? e.message : t('instances.listError')
  } finally {
    loading.value = false
  }
}

onMounted(loadInstances)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(locale.value)
}

const statusColor: Record<InstanceStatus, string> = {
  new: 'bg-muted text-muted-foreground',
  connecting: 'bg-amber-500/15 text-amber-600',
  awaiting_qr: 'bg-amber-500/15 text-amber-600',
  password_required: 'bg-amber-500/15 text-amber-600',
  authorized: 'bg-green-500/15 text-green-600',
  disconnected: 'bg-muted text-muted-foreground',
  error: 'bg-red-500/15 text-red-600',
}

async function removeInstance(inst: TelegramInstance) {
  if (!window.confirm(t('instances.confirmDelete'))) return
  await api.deleteInstance(inst.id)
  await loadInstances()
}

// --- Add / QR login modal ---

const showModal = ref(false)
const phase = ref<'form' | 'qr'>('form')
const label = ref('')
const engine = ref<EngineKey>('gramjs')
const creating = ref(false)
const createError = ref('')

const currentId = ref('')
const qrDataUrl = ref('')
const qrError = ref('')
const passwordRequired = ref(false)
const password = ref('')
const submittingPwd = ref(false)
const authorizedName = ref('')

let stream: EventSource | null = null
let done = false

function closeStream() {
  stream?.close()
  stream = null
}

function openAdd() {
  phase.value = 'form'
  label.value = ''
  engine.value = 'gramjs'
  createError.value = ''
  showModal.value = true
}

function closeModal() {
  closeStream()
  showModal.value = false
}

async function submitCreate() {
  if (!label.value.trim()) return
  creating.value = true
  createError.value = ''
  try {
    const inst = await api.createInstance({
      label: label.value.trim(),
      engine: engine.value,
    })
    currentId.value = inst.id
    startQr(inst.id)
    phase.value = 'qr'
  } catch (e) {
    createError.value = e instanceof Error ? e.message : t('instances.createFailed')
  } finally {
    creating.value = false
  }
}

function startQr(id: string) {
  done = false
  qrDataUrl.value = ''
  qrError.value = ''
  passwordRequired.value = false
  password.value = ''
  submittingPwd.value = false
  authorizedName.value = ''

  stream = api.qrLoginStream(id)
  stream.onmessage = (ev: MessageEvent<string>) => {
    void handleEvent(JSON.parse(ev.data) as QrLoginEvent)
  }
  stream.onerror = () => {
    if (!done) {
      qrError.value = t('instances.listError')
      done = true
      closeStream()
    }
  }
}

async function handleEvent(event: QrLoginEvent) {
  switch (event.type) {
    case 'qr':
      qrError.value = ''
      qrDataUrl.value = await QRCode.toDataURL(event.url, {
        width: 224,
        margin: 1,
      })
      break
    case 'password_required':
      passwordRequired.value = true
      break
    case 'authorized':
      done = true
      authorizedName.value =
        event.me.username ?? event.me.firstName ?? event.me.id
      closeStream()
      void loadInstances()
      break
    case 'error':
      done = true
      qrError.value = event.message
      closeStream()
      break
  }
}

async function submitPassword() {
  if (!password.value) return
  submittingPwd.value = true
  try {
    await api.submitQrPassword(currentId.value, password.value)
    passwordRequired.value = false
  } catch (e) {
    qrError.value = e instanceof Error ? e.message : t('instances.errorPrefix')
  } finally {
    submittingPwd.value = false
  }
}

onUnmounted(closeStream)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ t('instances.title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('instances.subtitle') }}</p>
      </div>
      <Button @click="openAdd">
        <Plus class="h-4 w-4" /> {{ t('instances.add') }}
      </Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-left text-muted-foreground">
              <th class="px-4 py-3 font-medium">{{ t('instances.colLabel') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('instances.colEngine') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('instances.colStatus') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('instances.colUser') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('instances.colCreated') }}</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="px-4 py-6 text-center text-muted-foreground">
                {{ t('common.loading') }}
              </td>
            </tr>
            <tr v-else-if="listError">
              <td colspan="6" class="px-4 py-6 text-center text-destructive">
                {{ listError }}
              </td>
            </tr>
            <tr v-else-if="!instances.length">
              <td colspan="6" class="px-4 py-6 text-center text-muted-foreground">
                {{ t('instances.empty') }}
              </td>
            </tr>
            <tr
              v-for="inst in instances"
              :key="inst.id"
              class="border-b last:border-0 hover:bg-muted/40"
            >
              <td class="px-4 py-3 font-medium">{{ inst.label }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ inst.engine }}</td>
              <td class="px-4 py-3">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="statusColor[inst.status]"
                >
                  {{ t(`instances.status.${inst.status}`) }}
                </span>
              </td>
              <td class="px-4 py-3 text-muted-foreground">
                {{ inst.username ? '@' + inst.username : '—' }}
              </td>
              <td class="px-4 py-3 text-muted-foreground">{{ fmtDate(inst.createdAt) }}</td>
              <td class="px-4 py-3 text-right">
                <Button
                  v-if="inst.status === 'authorized'"
                  variant="ghost"
                  size="icon"
                  :title="t('instances.openChats')"
                  @click="router.push({ name: 'instance-chats', params: { id: inst.id } })"
                >
                  <MessageSquare class="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" @click="removeInstance(inst)">
                  <Trash2 class="h-4 w-4 text-destructive" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>

    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closeModal"
      >
        <Card class="w-full max-w-md">
          <CardHeader class="flex-row items-start justify-between">
            <div>
              <CardTitle class="flex items-center gap-2 text-base">
                <Server class="h-4 w-4" /> {{ t('instances.modalTitle') }}
              </CardTitle>
              <CardDescription>{{ t('instances.modalDesc') }}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" @click="closeModal">
              <X class="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <!-- Phase 1: create -->
            <form
              v-if="phase === 'form'"
              class="grid gap-4"
              @submit.prevent="submitCreate"
            >
              <div class="grid gap-2">
                <Label for="label">{{ t('instances.label') }}</Label>
                <Input id="label" v-model="label" placeholder="Main account" />
              </div>
              <div class="grid gap-2">
                <Label for="engine">{{ t('instances.engine') }}</Label>
                <div class="relative">
                  <select
                    id="engine"
                    v-model="engine"
                    class="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&>option]:bg-background [&>option]:text-foreground"
                  >
                    <option
                      v-for="e in engines"
                      :key="e.key"
                      :value="e.key"
                      :disabled="e.disabled"
                    >
                      {{ e.label }}{{ e.disabled ? ' (soon)' : '' }}
                    </option>
                  </select>
                  <ChevronDown
                    class="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                </div>
              </div>
              <p v-if="createError" class="text-sm text-destructive">{{ createError }}</p>
              <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" @click="closeModal">
                  {{ t('common.cancel') }}
                </Button>
                <Button type="submit" :disabled="creating">
                  {{ creating ? t('common.creating') : t('common.create') }}
                </Button>
              </div>
            </form>

            <!-- Phase 2: QR login -->
            <div v-else class="flex flex-col items-center gap-3 text-center">
              <template v-if="authorizedName">
                <p class="text-sm font-medium text-green-600">
                  {{ t('instances.authorized', { name: authorizedName }) }}
                </p>
                <Button @click="closeModal">{{ t('common.cancel') }}</Button>
              </template>

              <template v-else-if="passwordRequired">
                <p class="text-sm font-medium">{{ t('instances.passwordTitle') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('instances.passwordHint') }}</p>
                <form class="flex w-full gap-2" @submit.prevent="submitPassword">
                  <Input v-model="password" type="password" class="flex-1" />
                  <Button type="submit" :disabled="submittingPwd">
                    {{ t('instances.submitPassword') }}
                  </Button>
                </form>
                <p v-if="qrError" class="text-sm text-destructive">{{ qrError }}</p>
              </template>

              <template v-else>
                <p class="text-sm font-medium">{{ t('instances.qrTitle') }}</p>
                <img
                  v-if="qrDataUrl"
                  :src="qrDataUrl"
                  alt="QR"
                  class="h-56 w-56 rounded-md border bg-white p-2"
                />
                <p v-else class="py-8 text-sm text-muted-foreground">
                  {{ t('instances.qrWaiting') }}
                </p>
                <p class="max-w-xs text-xs text-muted-foreground">{{ t('instances.qrHint') }}</p>
                <p v-if="qrError" class="text-sm text-destructive">
                  {{ t('instances.errorPrefix') }}: {{ qrError }}
                </p>
              </template>
            </div>
          </CardContent>
        </Card>
      </div>
    </Teleport>
  </div>
</template>
