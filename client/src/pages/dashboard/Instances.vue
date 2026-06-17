<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="space-y-1">
    <h1 class="text-2xl font-semibold tracking-tight">{{ t('instances.title') }}</h1>
    <p class="text-sm text-muted-foreground">{{ t('instances.soon') }}</p>
  </div>
</template>
