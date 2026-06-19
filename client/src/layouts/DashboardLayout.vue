<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ChevronLeft,
  ChevronRight,
  Github,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Server,
  Settings,
  Users,
  Webhook,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import HealthBadge from '@/components/HealthBadge.vue'
import AppControls from '@/components/AppControls.vue'

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()
const iconUrl = `${import.meta.env.BASE_URL}icon.png`
const version = __APP_VERSION__
const repoUrl = 'https://github.com/PedroL3m0z/Flux-Api'

const collapsed = ref(localStorage.getItem('sidebar-collapsed') === 'true')
function toggle() {
  collapsed.value = !collapsed.value
  localStorage.setItem('sidebar-collapsed', String(collapsed.value))
}

const nav = [
  { name: 'overview', key: 'nav.overview', icon: LayoutDashboard },
  { name: 'instances', key: 'nav.instances', icon: Server },
  { name: 'webhooks', key: 'nav.webhooks', icon: Webhook },
  { name: 'users', key: 'nav.users', icon: Users },
  { name: 'settings', key: 'nav.settings', icon: Settings },
  { name: 'help', key: 'nav.help', icon: HelpCircle },
]

async function onLogout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-muted/30">
    <aside
      class="hidden shrink-0 flex-col overflow-y-auto border-r bg-card transition-[width] duration-200 md:flex"
      :class="collapsed ? 'w-16' : 'w-56'"
    >
      <div
        class="flex h-14 items-center border-b px-3"
        :class="collapsed ? 'justify-center' : 'gap-2'"
      >
        <img :src="iconUrl" alt="Flux" class="h-8 w-8 shrink-0" />
        <span v-if="!collapsed" class="font-semibold">Flux</span>
      </div>

      <nav class="flex flex-1 flex-col gap-1 p-2">
        <RouterLink
          v-for="item in nav"
          :key="item.name"
          :to="{ name: item.name }"
          :title="collapsed ? t(item.key) : undefined"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          :class="collapsed ? 'justify-center' : ''"
          active-class="bg-accent text-accent-foreground"
        >
          <component :is="item.icon" class="h-4 w-4 shrink-0" />
          <span v-if="!collapsed">{{ t(item.key) }}</span>
        </RouterLink>
      </nav>

      <div class="space-y-1 border-t p-2">
        <HealthBadge :compact="collapsed" />
        <div
          class="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70"
        >
          <span :title="`Flux v${version}`">{{ collapsed ? version : `v${version}` }}</span>
          <a
            :href="repoUrl"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            class="inline-flex items-center transition-colors hover:text-foreground"
          >
            <Github class="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
        <Button
          variant="ghost"
          size="icon"
          class="hidden md:inline-flex"
          :title="collapsed ? t('nav.expand') : t('nav.collapse')"
          @click="toggle"
        >
          <component :is="collapsed ? ChevronRight : ChevronLeft" class="h-4 w-4" />
        </Button>
        <span class="text-sm font-medium md:hidden">Flux Dashboard</span>
        <div class="ml-auto flex items-center gap-3">
          <AppControls />
          <span class="text-sm text-muted-foreground">{{ auth.user?.username }}</span>
          <Button variant="outline" size="sm" @click="onLogout">
            <LogOut class="h-4 w-4" /> {{ t('common.logout') }}
          </Button>
        </div>
      </header>
      <main class="flex-1 overflow-y-auto p-4 md:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
