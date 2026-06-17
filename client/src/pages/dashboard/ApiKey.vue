<script setup lang="ts">
import { ref } from 'vue'
import { KeyRound } from 'lucide-vue-next'
import { api } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardDescription from '@/components/ui/CardDescription.vue'
import CardContent from '@/components/ui/CardContent.vue'

const apiKey = ref('')
const result = ref('')

async function check() {
  result.value = ''
  try {
    const res = await api.apiKeyCheck(apiKey.value)
    result.value = res.ok ? '✅ Chave válida' : '❌ Inválida'
  } catch {
    result.value = '❌ Chave inválida'
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">API Key</h1>
      <p class="text-sm text-muted-foreground">Testa o header x-api-key.</p>
    </div>
    <Card class="max-w-lg">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-base">
          <KeyRound class="h-4 w-4" /> Testar API Key
        </CardTitle>
        <CardDescription>Chama GET /auth/api-key-check</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="grid flex-1 gap-2">
          <Label for="apikey">x-api-key</Label>
          <Input id="apikey" v-model="apiKey" placeholder="sua API key" />
        </div>
        <Button @click="check">Verificar</Button>
        <span class="text-sm">{{ result }}</span>
      </CardContent>
    </Card>
  </div>
</template>
