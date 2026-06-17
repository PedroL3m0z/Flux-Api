<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Activity, RefreshCw } from 'lucide-vue-next'
import { api, type HealthResult } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardDescription from '@/components/ui/CardDescription.vue'
import CardContent from '@/components/ui/CardContent.vue'

const health = ref<HealthResult | null>(null)
const error = ref('')
const loading = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    health.value = await api.health()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Indisponível'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Saúde</h1>
        <p class="text-sm text-muted-foreground">Estado dos serviços.</p>
      </div>
      <Button variant="outline" size="sm" :disabled="loading" @click="load">
        <RefreshCw class="h-4 w-4" /> Atualizar
      </Button>
    </div>
    <Card class="max-w-md">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-base">
          <Activity class="h-4 w-4" /> Indicadores
        </CardTitle>
        <CardDescription>Postgres · Redis · Memória</CardDescription>
      </CardHeader>
      <CardContent class="space-y-1 text-sm">
        <p v-if="error" class="text-destructive">{{ error }}</p>
        <template v-else-if="health">
          <p><span class="text-muted-foreground">Status:</span> {{ health.status }}</p>
          <p v-for="(v, k) in health.info" :key="k">
            <span class="text-muted-foreground">{{ k }}:</span> {{ v.status }}
          </p>
        </template>
        <p v-else class="text-muted-foreground">Carregando...</p>
      </CardContent>
    </Card>
  </div>
</template>
