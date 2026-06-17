<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const auth = useAuthStore()
const logoUrl = `${import.meta.env.BASE_URL}logo.png`

function goHome() {
  void router.push(auth.user ? { name: 'dashboard' } : { name: 'login' })
}
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 p-4 text-center"
  >
    <img :src="logoUrl" alt="Flux" class="h-12 w-auto opacity-80" />
    <p class="text-6xl font-bold tracking-tight text-primary">404</p>
    <h1 class="text-xl font-semibold">Página não encontrada</h1>
    <p class="max-w-sm text-sm text-muted-foreground">
      A rota que você tentou acessar não existe.
    </p>
    <Button @click="goHome">Voltar ao início</Button>
  </div>
</template>
