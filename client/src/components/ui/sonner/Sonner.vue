<script setup lang="ts">
import { Toaster as Sonner } from 'vue-sonner'
import { useTheme } from '@/composables/useTheme'

const { theme } = useTheme()
</script>

<template>
  <Sonner
    :theme="theme"
    class="toaster group"
    rich-colors
    close-button
    position="bottom-right"
  />
</template>
