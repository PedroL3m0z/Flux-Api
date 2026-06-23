<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import AppControls from '@/components/AppControls.vue'

const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()
const logoUrl = `${import.meta.env.BASE_URL}logo.png`

function goHome() {
  void router.push(auth.user ? { name: 'overview' } : { name: 'home' })
}
</script>

<template>
  <div
    class="relative flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 p-4 text-center"
  >
    <div class="absolute right-4 top-4">
      <AppControls />
    </div>
    <img :src="logoUrl" alt="Flux" class="h-12 w-auto opacity-80" />
    <p class="text-6xl font-bold tracking-tight text-primary">404</p>
    <h1 class="text-xl font-semibold">{{ t('notFound.title') }}</h1>
    <p class="max-w-sm text-sm text-muted-foreground">{{ t('notFound.desc') }}</p>
    <Button @click="goHome">{{ t('notFound.back') }}</Button>
  </div>
</template>
