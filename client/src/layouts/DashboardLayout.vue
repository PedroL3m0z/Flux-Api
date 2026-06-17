<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { KeyRound, LayoutDashboard, LogOut, Server, Users } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import HealthBadge from '@/components/HealthBadge.vue'

const auth = useAuthStore()
const router = useRouter()
const logoUrl = `${import.meta.env.BASE_URL}logo.png`

const nav = [
  { name: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { name: 'users', label: 'Usuários', icon: Users },
  { name: 'instances', label: 'Instâncias', icon: Server },
  { name: 'api-key', label: 'API Key', icon: KeyRound },
]

async function onLogout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-screen bg-muted/30">
    <aside class="hidden w-56 flex-col border-r bg-card md:flex">
      <div class="flex items-center gap-2 border-b px-4 py-4">
        <img :src="logoUrl" alt="Flux" class="h-8 w-auto" />
        <span class="font-semibold">Flux</span>
      </div>
      <nav class="flex flex-1 flex-col gap-1 p-3">
        <RouterLink
          v-for="item in nav"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          active-class="bg-accent text-accent-foreground"
        >
          <component :is="item.icon" class="h-4 w-4" />
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="border-t p-3">
        <HealthBadge />
      </div>
    </aside>

    <div class="flex flex-1 flex-col">
      <header class="flex items-center justify-between border-b bg-card px-4 py-3">
        <span class="text-sm font-medium md:hidden">Flux Dashboard</span>
        <div class="ml-auto flex items-center gap-3">
          <span class="text-sm text-muted-foreground">{{ auth.user?.username }}</span>
          <Button variant="outline" size="sm" @click="onLogout">
            <LogOut class="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>
      <main class="flex-1 p-4 md:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
