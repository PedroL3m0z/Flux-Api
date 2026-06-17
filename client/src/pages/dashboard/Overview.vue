<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { t } = useI18n()
</script>

<template>
  <div class="space-y-1">
    <h1 class="text-2xl font-semibold tracking-tight">{{ t('overview.title') }}</h1>
    <p class="text-sm text-muted-foreground">
      {{ t('overview.welcome', { name: auth.user?.username }) }}
    </p>
  </div>
</template>
