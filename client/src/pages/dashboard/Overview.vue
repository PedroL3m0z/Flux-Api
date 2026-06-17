<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="space-y-1">
    <h1 class="text-2xl font-semibold tracking-tight">Visão geral</h1>
    <p class="text-sm text-muted-foreground">
      Bem-vindo de volta, {{ auth.user?.username }}.
    </p>
  </div>
</template>
