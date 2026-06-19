<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Activity, Clock, Server, Webhook } from 'lucide-vue-next'
import { api, type SystemStats } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'

const auth = useAuthStore()
const { t } = useI18n()

const stats = ref<SystemStats | null>(null)
const webhookCount = ref<number | null>(null)
let timer: number | undefined

async function load() {
  try {
    stats.value = await api.stats()
  } catch {
    stats.value = null
  }
  try {
    webhookCount.value = (await api.webhooks()).length
  } catch {
    webhookCount.value = null
  }
}

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(
    Boolean,
  )
  return parts.join(' ')
}

const uptime = computed(() =>
  stats.value ? fmtUptime(stats.value.uptimeSeconds) : '—',
)
const allHealthy = computed(
  () =>
    !!stats.value &&
    stats.value.instances.total > 0 &&
    stats.value.instances.authorized === stats.value.instances.total,
)

onMounted(() => {
  void load()
  timer = window.setInterval(() => void load(), 10000)
})
onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('overview.title') }}</h1>
      <p class="text-sm text-muted-foreground">
        {{ t('overview.welcome', { name: auth.user?.username }) }}
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">
            {{ t('overview.uptime') }}
          </CardTitle>
          <Clock class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-semibold tabular-nums">{{ uptime }}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">
            {{ t('overview.instances') }}
          </CardTitle>
          <Server class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-semibold tabular-nums">
            {{ stats?.instances.total ?? '—' }}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">
            {{ t('overview.functional') }}
          </CardTitle>
          <Activity
            class="h-4 w-4"
            :class="allHealthy ? 'text-green-500' : 'text-muted-foreground'"
          />
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-semibold tabular-nums">
            {{ stats ? `${stats.instances.authorized}/${stats.instances.total}` : '—' }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('overview.connected', { n: stats?.instances.connected ?? 0 }) }}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">
            {{ t('overview.webhooks') }}
          </CardTitle>
          <Webhook class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-semibold tabular-nums">
            {{ webhookCount ?? '—' }}
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
