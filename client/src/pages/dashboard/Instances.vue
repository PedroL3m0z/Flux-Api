<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import QRCode from 'qrcode'
import {
  ChevronDown,
  Info,
  LogIn,
  MessageSquare,
  Play,
  Plus,
  Server,
  Square,
  Trash2,
  X,
} from 'lucide-vue-next'
import {
  api,
  type EngineKey,
  type InstanceInfo,
  type InstanceStatus,
  type LoginMethod,
  type QrLoginEvent,
  type SessionStatusEvent,
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

/** Can perform operational actions (start/stop, send): operator and above. */
function canOperate(inst: TelegramInstance): boolean {
  return ['admin', 'operator'].includes(inst.myRole ?? 'viewer')
}

/** Can delete instances: operator and above. */
function canManage(inst: TelegramInstance): boolean {
  return ['admin', 'operator'].includes(inst.myRole ?? 'viewer')
}

/** Statuses with no usable session — a fresh QR/phone login is needed.
 *  Excludes `disconnected` (stopped but session kept → use Start) and the
 *  running/connecting states. */
const NEEDS_LOGIN_STATUSES: InstanceStatus[] = [
  'new',
  'awaiting_qr',
  'awaiting_code',
  'password_required',
  'error',
]

/** Whether to offer the Connect (re-login) action for this instance. */
function needsLogin(inst: TelegramInstance): boolean {
  return canOperate(inst) && NEEDS_LOGIN_STATUSES.includes(inst.status)
}

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

onMounted(() => {
  void loadInstances()
  connectStatusStream()
})

let statusStream: EventSource | null = null

function connectStatusStream() {
  statusStream?.close()
  statusStream = api.instanceStatusStream()
  statusStream.onmessage = (ev: MessageEvent<string>) => {
    void handleStatusEvent(JSON.parse(ev.data) as SessionStatusEvent)
  }
}

async function handleStatusEvent(event: SessionStatusEvent) {
  const prev = instances.value.find((i) => i.id === event.instanceId)
  await loadInstances()
  if (
    event.status === 'error' &&
    prev &&
    ['authorized', 'connecting'].includes(prev.status)
  ) {
    toast.error(
      t('instances.sessionRevoked', {
        label: prev.label,
        message: event.message ?? t('instances.sessionRevokedDefault'),
      }),
    )
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(locale.value)
}

// Account display: real name, falling back to @username, then dash.
function accountName(inst: TelegramInstance): string {
  if (inst.firstName) return inst.firstName
  if (inst.username) return '@' + inst.username
  return '—'
}

const statusColor: Record<InstanceStatus, string> = {
  new: 'bg-muted text-muted-foreground',
  connecting: 'bg-amber-500/15 text-amber-600',
  awaiting_qr: 'bg-amber-500/15 text-amber-600',
  awaiting_code: 'bg-amber-500/15 text-amber-600',
  password_required: 'bg-amber-500/15 text-amber-600',
  authorized: 'bg-green-500/15 text-green-600',
  disconnected: 'bg-muted text-muted-foreground',
  error: 'bg-red-500/15 text-red-600',
}

async function removeInstance(inst: TelegramInstance) {
  if (!window.confirm(t('instances.confirmDelete'))) return
  try {
    await api.deleteInstance(inst.id)
    await loadInstances()
    toast.success(t('instances.deleted'))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('instances.actionFailed'))
  }
}

// --- Start / stop ---

const busyId = ref('')

async function startInstance(inst: TelegramInstance) {
  busyId.value = inst.id
  try {
    await api.startInstance(inst.id)
    await loadInstances()
    toast.success(t('instances.started'))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('instances.actionFailed'))
  } finally {
    busyId.value = ''
  }
}

async function stopInstance(inst: TelegramInstance) {
  busyId.value = inst.id
  try {
    await api.stopInstance(inst.id)
    await loadInstances()
    toast.success(t('instances.stopped'))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('instances.actionFailed'))
  } finally {
    busyId.value = ''
  }
}

// --- Info panel ---

const showInfo = ref(false)
const info = ref<InstanceInfo | null>(null)
const infoLoading = ref(false)
let infoTimer: ReturnType<typeof setInterval> | null = null

async function refreshInfo(id: string) {
  try {
    info.value = await api.instanceInfo(id)
  } catch {
    /* keep last value */
  }
}

async function openInfo(inst: TelegramInstance) {
  showInfo.value = true
  info.value = null
  infoLoading.value = true
  await refreshInfo(inst.id)
  infoLoading.value = false
  infoTimer = setInterval(() => void refreshInfo(inst.id), 5000)
}

function closeInfo() {
  showInfo.value = false
  if (infoTimer) {
    clearInterval(infoTimer)
    infoTimer = null
  }
}

function fmtUptime(seconds: number | null): string {
  if (seconds == null) return t('instances.infoOffline')
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}

// --- Add / login modal ---

type LoginPhase = 'form' | 'qr' | 'phone' | 'code' | 'password'

const showModal = ref(false)
const modalMode = ref<'create' | 'connect'>('create')
const phase = ref<LoginPhase>('form')
const loginMethod = ref<LoginMethod>('qr')
const label = ref('')
const engine = ref<EngineKey>('gramjs')
const creating = ref(false)
const createError = ref('')

const currentId = ref('')
const qrDataUrl = ref('')
const loginError = ref('')
const passwordRequired = ref(false)
const password = ref('')
const submittingPwd = ref(false)
const authorizedName = ref('')

const phoneNumber = ref('')
const sendingPhone = ref(false)
const phoneCode = ref('')
const submittingCode = ref(false)
const loginMode = ref<'qr' | 'phone'>('qr')

let stream: EventSource | null = null
let done = false

function closeStream() {
  stream?.close()
  stream = null
}

function resetLoginState() {
  loginMethod.value = 'qr'
  createError.value = ''
  loginError.value = ''
  phoneNumber.value = ''
  phoneCode.value = ''
  passwordRequired.value = false
  password.value = ''
  authorizedName.value = ''
}

/** Warns (toast) when global api_id/api_hash are missing — login will fail
 *  without them. Non-blocking: the modal still opens. */
async function warnIfNoCreds() {
  try {
    const s = await api.getSettings()
    if (!s.apiId || !s.hasApiHash) {
      toast.warning(t('instances.credsMissing'))
    }
  } catch {
    /* settings load failed; ignore here */
  }
}

function openAdd() {
  void warnIfNoCreds()
  modalMode.value = 'create'
  phase.value = 'form'
  label.value = ''
  engine.value = 'gramjs'
  resetLoginState()
  showModal.value = true
}

/** Re-open the login flow for an instance that already exists (failed/abandoned
 *  QR or phone login leaves it without a valid session). */
function openConnect(inst: TelegramInstance) {
  void warnIfNoCreds()
  modalMode.value = 'connect'
  phase.value = 'form'
  currentId.value = inst.id
  label.value = inst.label
  resetLoginState()
  showModal.value = true
}

/** Starts the chosen login method against an existing instance id. */
function proceedLogin() {
  loginMode.value = loginMethod.value
  if (loginMethod.value === 'qr') {
    phase.value = 'qr'
    startQr(currentId.value)
  } else {
    phase.value = 'phone'
  }
}

function closeModal() {
  closeStream()
  showModal.value = false
}

function onAuthorized(me: { firstName?: string; username?: string; id: string }) {
  authorizedName.value = me.firstName ?? me.username ?? me.id
  void loadInstances()
  toast.success(t('instances.authorized', { name: authorizedName.value }))
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
    await loadInstances()
    proceedLogin()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : t('instances.createFailed')
  } finally {
    creating.value = false
  }
}

async function sendPhoneLogin() {
  if (!phoneNumber.value.trim()) return
  sendingPhone.value = true
  loginError.value = ''
  try {
    await api.startPhoneLogin(currentId.value, phoneNumber.value.trim())
    phase.value = 'code'
    toast.success(t('instances.codeSent'))
  } catch (e) {
    loginError.value = e instanceof Error ? e.message : t('instances.actionFailed')
  } finally {
    sendingPhone.value = false
  }
}

async function submitPhoneCode() {
  if (!phoneCode.value.trim()) return
  submittingCode.value = true
  loginError.value = ''
  try {
    const step = await api.submitPhoneCode(
      currentId.value,
      phoneCode.value.trim(),
    )
    if (step.status === 'authorized' && step.me) {
      onAuthorized(step.me)
    } else {
      phase.value = 'password'
      passwordRequired.value = true
    }
  } catch (e) {
    loginError.value = e instanceof Error ? e.message : t('instances.actionFailed')
  } finally {
    submittingCode.value = false
  }
}

function startQr(id: string) {
  done = false
  qrDataUrl.value = ''
  loginError.value = ''
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
      loginError.value = t('instances.listError')
      done = true
      closeStream()
    }
  }
}

async function handleEvent(event: QrLoginEvent) {
  switch (event.type) {
    case 'qr':
      loginError.value = ''
      qrDataUrl.value = await QRCode.toDataURL(event.url, {
        width: 224,
        margin: 1,
      })
      break
    case 'password_required':
      passwordRequired.value = true
      phase.value = 'password'
      break
    case 'authorized':
      done = true
      closeStream()
      onAuthorized(event.me)
      break
    case 'error':
      done = true
      loginError.value = event.message
      closeStream()
      toast.error(event.message)
      break
  }
}

async function submitPassword() {
  if (!password.value) return
  submittingPwd.value = true
  try {
    const res = await api.submitQrPassword(currentId.value, password.value)
    if (loginMode.value === 'phone' && res.me) {
      passwordRequired.value = false
      onAuthorized(res.me)
    } else {
      passwordRequired.value = false
    }
  } catch (e) {
    loginError.value = e instanceof Error ? e.message : t('instances.errorPrefix')
  } finally {
    submittingPwd.value = false
  }
}

onUnmounted(() => {
  statusStream?.close()
  closeStream()
  closeInfo()
})
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
              <td class="px-4 py-3 text-muted-foreground">{{ accountName(inst) }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ fmtDate(inst.createdAt) }}</td>
              <td class="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  :title="t('instances.info')"
                  @click="openInfo(inst)"
                >
                  <Info class="h-4 w-4" />
                </Button>
                <Button
                  v-if="inst.status === 'authorized'"
                  variant="ghost"
                  size="icon"
                  :title="t('instances.openChats')"
                  @click="router.push({ name: 'instance-chats', params: { id: inst.id } })"
                >
                  <MessageSquare class="h-4 w-4" />
                </Button>
                <Button
                  v-if="inst.status === 'authorized' && canOperate(inst)"
                  variant="ghost"
                  size="icon"
                  :title="t('instances.stop')"
                  :disabled="busyId === inst.id"
                  @click="stopInstance(inst)"
                >
                  <Square class="h-4 w-4" />
                </Button>
                <Button
                  v-else-if="canOperate(inst) && (inst.status === 'disconnected' || inst.status === 'error')"
                  variant="ghost"
                  size="icon"
                  :title="t('instances.start')"
                  :disabled="busyId === inst.id"
                  @click="startInstance(inst)"
                >
                  <Play class="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  v-if="needsLogin(inst)"
                  variant="ghost"
                  size="icon"
                  :title="t('instances.connectAction')"
                  @click="openConnect(inst)"
                >
                  <LogIn class="h-4 w-4 text-primary" />
                </Button>
                <Button
                  v-if="canManage(inst)"
                  variant="ghost"
                  size="icon"
                  :title="t('instances.delete')"
                  @click="removeInstance(inst)"
                >
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
                <Server class="h-4 w-4" />
                {{ modalMode === 'create' ? t('instances.modalTitle') : t('instances.connectTitle') }}
              </CardTitle>
              <CardDescription>
                {{ modalMode === 'create' ? t('instances.modalDesc') : t('instances.connectDesc', { label }) }}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" @click="closeModal">
              <X class="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <!-- Phase 1: create instance and/or pick a login method -->
            <form
              v-if="phase === 'form'"
              class="grid gap-4"
              @submit.prevent="modalMode === 'create' ? submitCreate() : proceedLogin()"
            >
              <div v-if="modalMode === 'create'" class="grid gap-2">
                <Label for="label">{{ t('instances.label') }}</Label>
                <Input id="label" v-model="label" placeholder="Main account" />
              </div>
              <div v-if="modalMode === 'create'" class="grid gap-2">
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
              <div class="grid gap-2">
                <Label>{{ t('instances.loginMethod') }}</Label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    class="rounded-md border px-3 py-2 text-sm transition-colors"
                    :class="loginMethod === 'qr'
                      ? 'border-primary bg-primary/5 font-medium text-primary'
                      : 'border-input text-muted-foreground hover:bg-muted/50'"
                    @click="loginMethod = 'qr'"
                  >
                    {{ t('instances.loginQr') }}
                  </button>
                  <button
                    type="button"
                    class="rounded-md border px-3 py-2 text-sm transition-colors"
                    :class="loginMethod === 'phone'
                      ? 'border-primary bg-primary/5 font-medium text-primary'
                      : 'border-input text-muted-foreground hover:bg-muted/50'"
                    @click="loginMethod = 'phone'"
                  >
                    {{ t('instances.loginPhone') }}
                  </button>
                </div>
                <p class="text-xs text-muted-foreground">
                  {{ loginMethod === 'qr' ? t('instances.loginQrHint') : t('instances.loginPhoneHint') }}
                </p>
              </div>
              <p v-if="createError" class="text-sm text-destructive">{{ createError }}</p>
              <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" @click="closeModal">
                  {{ t('common.cancel') }}
                </Button>
                <Button type="submit" :disabled="creating">
                  {{ modalMode === 'connect'
                    ? t('instances.connectAction')
                    : creating ? t('common.creating') : t('common.create') }}
                </Button>
              </div>
            </form>

            <!-- Phone: enter number -->
            <form
              v-else-if="phase === 'phone'"
              class="grid gap-4"
              @submit.prevent="sendPhoneLogin"
            >
              <p class="text-sm font-medium">{{ t('instances.phoneTitle') }}</p>
              <p class="text-xs text-muted-foreground">{{ t('instances.phoneHint') }}</p>
              <div class="grid gap-2">
                <Label for="phone">{{ t('instances.phoneLabel') }}</Label>
                <Input
                  id="phone"
                  v-model="phoneNumber"
                  type="tel"
                  placeholder="+5511999999999"
                  autocomplete="tel"
                />
              </div>
              <p v-if="loginError" class="text-sm text-destructive">{{ loginError }}</p>
              <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" @click="closeModal">
                  {{ t('common.cancel') }}
                </Button>
                <Button type="submit" :disabled="sendingPhone || !phoneNumber.trim()">
                  {{ sendingPhone ? t('common.loading') : t('instances.sendCode') }}
                </Button>
              </div>
            </form>

            <!-- Phone: enter OTP -->
            <form
              v-else-if="phase === 'code'"
              class="grid gap-4"
              @submit.prevent="submitPhoneCode"
            >
              <p class="text-sm font-medium">{{ t('instances.codeTitle') }}</p>
              <p class="text-xs text-muted-foreground">{{ t('instances.codeHint') }}</p>
              <div class="grid gap-2">
                <Label for="code">{{ t('instances.codeLabel') }}</Label>
                <Input
                  id="code"
                  v-model="phoneCode"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  placeholder="12345"
                />
              </div>
              <p v-if="loginError" class="text-sm text-destructive">{{ loginError }}</p>
              <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" @click="closeModal">
                  {{ t('common.cancel') }}
                </Button>
                <Button type="submit" :disabled="submittingCode || !phoneCode.trim()">
                  {{ submittingCode ? t('common.loading') : t('instances.verifyCode') }}
                </Button>
              </div>
            </form>

            <!-- QR login or shared 2FA / success -->
            <div v-else class="flex flex-col items-center gap-3 text-center">
              <template v-if="authorizedName">
                <p class="text-sm font-medium text-green-600">
                  {{ t('instances.authorized', { name: authorizedName }) }}
                </p>
                <Button @click="closeModal">{{ t('common.cancel') }}</Button>
              </template>

              <template v-else-if="passwordRequired || phase === 'password'">
                <p class="text-sm font-medium">{{ t('instances.passwordTitle') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('instances.passwordHint') }}</p>
                <form class="flex w-full gap-2" @submit.prevent="submitPassword">
                  <Input v-model="password" type="password" class="flex-1" />
                  <Button type="submit" :disabled="submittingPwd">
                    {{ t('instances.submitPassword') }}
                  </Button>
                </form>
                <p v-if="loginError" class="text-sm text-destructive">{{ loginError }}</p>
              </template>

              <template v-else-if="phase === 'qr'">
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
                <p v-if="loginError" class="text-sm text-destructive">
                  {{ t('instances.errorPrefix') }}: {{ loginError }}
                </p>
              </template>
            </div>
          </CardContent>
        </Card>
      </div>
    </Teleport>

    <!-- Info panel -->
    <Teleport to="body">
      <div
        v-if="showInfo"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closeInfo"
      >
        <Card class="w-full max-w-md">
          <CardHeader class="flex-row items-start justify-between">
            <CardTitle class="flex items-center gap-2 text-base">
              <Info class="h-4 w-4" /> {{ t('instances.infoTitle') }}
            </CardTitle>
            <Button variant="ghost" size="icon" @click="closeInfo">
              <X class="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <p v-if="infoLoading" class="py-6 text-center text-sm text-muted-foreground">
              {{ t('common.loading') }}
            </p>
            <dl v-else-if="info" class="grid grid-cols-3 gap-x-3 gap-y-3 text-sm">
              <dt class="text-muted-foreground">{{ t('instances.infoAccount') }}</dt>
              <dd class="col-span-2 break-words font-medium">
                {{ accountName(info) }}
                <span v-if="info.firstName && info.username" class="text-muted-foreground">
                  (@{{ info.username }})
                </span>
              </dd>

              <dt class="text-muted-foreground">{{ t('instances.infoLabel') }}</dt>
              <dd class="col-span-2 break-words font-medium">{{ info.label }}</dd>

              <dt class="text-muted-foreground">{{ t('instances.infoId') }}</dt>
              <dd class="col-span-2 break-all font-mono text-xs">{{ info.id }}</dd>

              <dt class="text-muted-foreground">{{ t('instances.infoStatus') }}</dt>
              <dd class="col-span-2">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="statusColor[info.status]"
                >
                  {{ t(`instances.status.${info.status}`) }}
                </span>
              </dd>

              <dt class="text-muted-foreground">{{ t('instances.infoPhone') }}</dt>
              <dd class="col-span-2 font-medium">{{ info.phone ? '+' + info.phone : '—' }}</dd>

              <dt class="text-muted-foreground">{{ t('instances.infoCreated') }}</dt>
              <dd class="col-span-2 font-medium">{{ fmtDate(info.createdAt) }}</dd>

              <dt class="text-muted-foreground">{{ t('instances.infoUptime') }}</dt>
              <dd class="col-span-2 font-medium">{{ fmtUptime(info.uptimeSeconds) }}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </Teleport>
  </div>
</template>
