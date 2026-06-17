<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { api } from '@/lib/api'

type State = 'loading' | 'ok' | 'down'
const state = ref<State>('loading')
let timer: number | undefined

async function check() {
  try {
    const h = await api.health()
    state.value = h.status === 'ok' ? 'ok' : 'down'
  } catch {
    state.value = 'down'
  }
}

onMounted(() => {
  void check()
  timer = window.setInterval(() => void check(), 15000)
})
onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})

const label = { loading: 'Verificando...', ok: 'Serviços OK', down: 'Serviços fora' }
const dot = {
  loading: 'bg-muted-foreground',
  ok: 'bg-green-500',
  down: 'bg-red-500',
}
</script>

<template>
  <div
    class="flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground"
  >
    <span class="h-2 w-2 rounded-full" :class="dot[state]" />
    {{ label[state] }}
  </div>
</template>
