<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Moon, Sun } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { setLocale, type LocaleCode } from '@/i18n'
import Button from '@/components/ui/Button.vue'

const { theme, toggle } = useTheme()
const { locale } = useI18n()

function toggleLocale() {
  const next: LocaleCode = locale.value === 'pt-BR' ? 'en' : 'pt-BR'
  setLocale(next)
}
</script>

<template>
  <div class="flex items-center gap-1">
    <Button
      variant="ghost"
      size="sm"
      class="font-semibold uppercase"
      title="Idioma / Language"
      @click="toggleLocale"
    >
      {{ locale === 'pt-BR' ? 'PT' : 'EN' }}
    </Button>
    <Button variant="ghost" size="icon" title="Tema / Theme" @click="toggle">
      <component :is="theme === 'dark' ? Sun : Moon" class="h-4 w-4" />
    </Button>
  </div>
</template>
