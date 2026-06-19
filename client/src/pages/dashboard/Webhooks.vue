<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import {
  Copy,
  KeyRound,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Trash2,
  Webhook as WebhookIcon,
  X,
} from 'lucide-vue-next'
import {
  api,
  WEBHOOK_EVENT_TYPES,
  type TelegramInstance,
  type Webhook,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
} from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardDescription from '@/components/ui/CardDescription.vue'
import CardContent from '@/components/ui/CardContent.vue'

const { t, locale } = useI18n()

const webhooks = ref<Webhook[]>([])
const instances = ref<TelegramInstance[]>([])
const loading = ref(false)
const listError = ref('')
const busyId = ref('')

async function load() {
  loading.value = true
  listError.value = ''
  try {
    const [w, i] = await Promise.all([api.webhooks(), api.telegramInstances()])
    webhooks.value = w
    instances.value = i
  } catch (e) {
    listError.value = e instanceof Error ? e.message : t('webhooks.listError')
  } finally {
    loading.value = false
  }
}

onMounted(load)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(locale.value)
}

// --- Create / edit modal ---
const showForm = ref(false)
const editing = ref<Webhook | null>(null)
const saving = ref(false)
const form = ref({
  name: '',
  url: '',
  events: [] as string[],
  instanceIds: [] as string[],
})

function openCreate() {
  editing.value = null
  form.value = { name: '', url: '', events: [], instanceIds: [] }
  showForm.value = true
}

function openEdit(w: Webhook) {
  editing.value = w
  form.value = {
    name: w.name,
    url: w.url,
    events: [...w.events],
    instanceIds: [...w.instanceIds],
  }
  showForm.value = true
}

function toggleArray(list: string[], value: string) {
  const idx = list.indexOf(value)
  if (idx === -1) list.push(value)
  else list.splice(idx, 1)
}

async function submitForm() {
  if (!form.value.name.trim() || !form.value.url.trim()) return
  if (!form.value.events.length) {
    toast.error(t('webhooks.needEvent'))
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await api.updateWebhook(editing.value.id, {
        name: form.value.name.trim(),
        url: form.value.url.trim(),
        events: form.value.events,
      })
      await reconcileInstances(editing.value, form.value.instanceIds)
      toast.success(t('webhooks.saved'))
    } else {
      const created = await api.createWebhook({
        name: form.value.name.trim(),
        url: form.value.url.trim(),
        events: form.value.events,
        instanceIds: form.value.instanceIds,
      })
      toast.success(t('webhooks.created'))
      showSecret(created.secret)
    }
    showForm.value = false
    await load()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('webhooks.saveFailed'))
  } finally {
    saving.value = false
  }
}

// Reconcile linked instances on edit (link added, unlink removed).
async function reconcileInstances(w: Webhook, next: string[]) {
  const toLink = next.filter((id) => !w.instanceIds.includes(id))
  const toUnlink = w.instanceIds.filter((id) => !next.includes(id))
  await Promise.all([
    ...toLink.map((id) => api.linkWebhookInstance(w.id, id)),
    ...toUnlink.map((id) => api.unlinkWebhookInstance(w.id, id)),
  ])
}

async function toggleActive(w: Webhook) {
  busyId.value = w.id
  try {
    await api.updateWebhook(w.id, { active: !w.active })
    await load()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('webhooks.saveFailed'))
  } finally {
    busyId.value = ''
  }
}

async function remove(w: Webhook) {
  if (!window.confirm(t('webhooks.confirmDelete'))) return
  try {
    await api.deleteWebhook(w.id)
    await load()
    toast.success(t('webhooks.deleted'))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('webhooks.saveFailed'))
  }
}

async function regenerate(w: Webhook) {
  if (!window.confirm(t('webhooks.confirmRegen'))) return
  try {
    const res = await api.regenerateWebhookSecret(w.id)
    showSecret(res.secret)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('webhooks.saveFailed'))
  }
}

// --- Secret modal ---
const secretValue = ref('')
const showSecretModal = ref(false)
function showSecret(secret: string) {
  secretValue.value = secret
  showSecretModal.value = true
}
async function copySecret() {
  await navigator.clipboard.writeText(secretValue.value)
  toast.success(t('webhooks.copied'))
}

// --- Deliveries modal ---
const showDeliveries = ref(false)
const deliveries = ref<WebhookDelivery[]>([])
const deliveriesLoading = ref(false)
const deliveriesFor = ref<Webhook | null>(null)

async function openDeliveries(w: Webhook) {
  deliveriesFor.value = w
  showDeliveries.value = true
  deliveriesLoading.value = true
  deliveries.value = []
  try {
    deliveries.value = await api.webhookDeliveries(w.id)
  } finally {
    deliveriesLoading.value = false
  }
}

async function resend(d: WebhookDelivery) {
  try {
    await api.resendWebhookDelivery(d.id)
    toast.success(t('webhooks.requeued'))
    if (deliveriesFor.value) await openDeliveries(deliveriesFor.value)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('webhooks.saveFailed'))
  }
}

const deliveryColor: Record<WebhookDeliveryStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-600',
  success: 'bg-green-500/15 text-green-600',
  failed: 'bg-amber-500/15 text-amber-600',
  dead: 'bg-red-500/15 text-red-600',
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ t('webhooks.title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('webhooks.subtitle') }}</p>
      </div>
      <Button @click="openCreate">
        <Plus class="h-4 w-4" /> {{ t('webhooks.add') }}
      </Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-left text-muted-foreground">
              <th class="px-4 py-3 font-medium">{{ t('webhooks.colName') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('webhooks.colUrl') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('webhooks.colEvents') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('webhooks.colInstances') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('webhooks.colStatus') }}</th>
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
              <td colspan="6" class="px-4 py-6 text-center text-destructive">{{ listError }}</td>
            </tr>
            <tr v-else-if="!webhooks.length">
              <td colspan="6" class="px-4 py-6 text-center text-muted-foreground">
                {{ t('webhooks.empty') }}
              </td>
            </tr>
            <tr
              v-for="w in webhooks"
              :key="w.id"
              class="border-b last:border-0 hover:bg-muted/40"
            >
              <td class="px-4 py-3 font-medium">{{ w.name }}</td>
              <td class="max-w-[220px] truncate px-4 py-3 text-muted-foreground">{{ w.url }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ w.events.length }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ w.instanceIds.length }}</td>
              <td class="px-4 py-3">
                <button
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="w.active ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'"
                  :disabled="busyId === w.id"
                  @click="toggleActive(w)"
                >
                  {{ w.active ? t('webhooks.active') : t('webhooks.inactive') }}
                </button>
              </td>
              <td class="px-4 py-3 text-right">
                <Button variant="ghost" size="icon" :title="t('webhooks.deliveries')" @click="openDeliveries(w)">
                  <Radio class="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" :title="t('webhooks.regen')" @click="regenerate(w)">
                  <KeyRound class="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" :title="t('common.edit')" @click="openEdit(w)">
                  <Pencil class="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" @click="remove(w)">
                  <Trash2 class="h-4 w-4 text-destructive" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>

    <!-- Create / edit modal -->
    <Teleport to="body">
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="showForm = false"
      >
        <Card class="max-h-[90vh] w-full max-w-lg overflow-y-auto">
          <CardHeader class="flex-row items-start justify-between">
            <div>
              <CardTitle class="flex items-center gap-2 text-base">
                <WebhookIcon class="h-4 w-4" />
                {{ editing ? t('webhooks.editTitle') : t('webhooks.modalTitle') }}
              </CardTitle>
              <CardDescription>{{ t('webhooks.modalDesc') }}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" @click="showForm = false">
              <X class="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form class="grid gap-4" @submit.prevent="submitForm">
              <div class="grid gap-2">
                <Label for="wname">{{ t('webhooks.name') }}</Label>
                <Input id="wname" v-model="form.name" placeholder="My integration" />
              </div>
              <div class="grid gap-2">
                <Label for="wurl">{{ t('webhooks.url') }}</Label>
                <Input id="wurl" v-model="form.url" placeholder="https://example.com/hooks" />
              </div>
              <div class="grid gap-2">
                <Label>{{ t('webhooks.events') }}</Label>
                <div class="grid grid-cols-2 gap-2">
                  <label
                    v-for="ev in WEBHOOK_EVENT_TYPES"
                    :key="ev"
                    class="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/50"
                    :class="form.events.includes(ev) ? 'border-primary bg-accent/40' : 'border-input'"
                  >
                    <Checkbox
                      :model-value="form.events.includes(ev)"
                      @update:model-value="toggleArray(form.events, ev)"
                    />
                    <span class="truncate font-mono text-xs">{{ ev }}</span>
                  </label>
                </div>
              </div>
              <div class="grid gap-2">
                <Label>{{ t('webhooks.instances') }}</Label>
                <p v-if="!instances.length" class="text-xs text-muted-foreground">
                  {{ t('webhooks.noInstances') }}
                </p>
                <div v-else class="grid gap-2">
                  <label
                    v-for="inst in instances"
                    :key="inst.id"
                    class="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/50"
                    :class="form.instanceIds.includes(inst.id) ? 'border-primary bg-accent/40' : 'border-input'"
                  >
                    <Checkbox
                      :model-value="form.instanceIds.includes(inst.id)"
                      @update:model-value="toggleArray(form.instanceIds, inst.id)"
                    />
                    <span class="truncate">{{ inst.label }}</span>
                  </label>
                </div>
              </div>
              <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" @click="showForm = false">
                  {{ t('common.cancel') }}
                </Button>
                <Button type="submit" :disabled="saving">
                  {{ saving ? t('common.creating') : editing ? t('common.save') : t('common.create') }}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Teleport>

    <!-- Secret modal -->
    <Teleport to="body">
      <div
        v-if="showSecretModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="showSecretModal = false"
      >
        <Card class="w-full max-w-md">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-base">
              <KeyRound class="h-4 w-4" /> {{ t('webhooks.secretTitle') }}
            </CardTitle>
            <CardDescription>{{ t('webhooks.secretDesc') }}</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-3">
            <code class="block break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
              {{ secretValue }}
            </code>
            <div class="flex justify-end gap-2">
              <Button variant="outline" @click="copySecret">
                <Copy class="h-4 w-4" /> {{ t('webhooks.copy') }}
              </Button>
              <Button @click="showSecretModal = false">{{ t('common.cancel') }}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Teleport>

    <!-- Deliveries modal -->
    <Teleport to="body">
      <div
        v-if="showDeliveries"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="showDeliveries = false"
      >
        <Card class="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
          <CardHeader class="flex-row items-start justify-between">
            <CardTitle class="flex items-center gap-2 text-base">
              <Radio class="h-4 w-4" /> {{ t('webhooks.deliveries') }}
            </CardTitle>
            <Button variant="ghost" size="icon" @click="showDeliveries = false">
              <X class="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent class="p-0">
            <p v-if="deliveriesLoading" class="p-6 text-center text-sm text-muted-foreground">
              {{ t('common.loading') }}
            </p>
            <p v-else-if="!deliveries.length" class="p-6 text-center text-sm text-muted-foreground">
              {{ t('webhooks.noDeliveries') }}
            </p>
            <table v-else class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-muted-foreground">
                  <th class="px-4 py-2 font-medium">{{ t('webhooks.colEvent') }}</th>
                  <th class="px-4 py-2 font-medium">{{ t('webhooks.colStatus') }}</th>
                  <th class="px-4 py-2 font-medium">{{ t('webhooks.colCode') }}</th>
                  <th class="px-4 py-2 font-medium">{{ t('webhooks.colAttempts') }}</th>
                  <th class="px-4 py-2 font-medium">{{ t('webhooks.colDate') }}</th>
                  <th class="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in deliveries" :key="d.id" class="border-b last:border-0">
                  <td class="px-4 py-2 font-mono text-xs">{{ d.event }}</td>
                  <td class="px-4 py-2">
                    <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="deliveryColor[d.status]">
                      {{ d.status }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-muted-foreground">{{ d.statusCode ?? '—' }}</td>
                  <td class="px-4 py-2 text-muted-foreground">{{ d.attempts }}</td>
                  <td class="px-4 py-2 text-muted-foreground">{{ fmtDate(d.createdAt) }}</td>
                  <td class="px-4 py-2 text-right">
                    <Button
                      v-if="d.status !== 'success'"
                      variant="ghost"
                      size="icon"
                      :title="t('webhooks.resend')"
                      @click="resend(d)"
                    >
                      <RefreshCw class="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </Teleport>
  </div>
</template>
