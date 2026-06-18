<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KeyRound, Send } from 'lucide-vue-next'
import { api } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardDescription from '@/components/ui/CardDescription.vue'
import CardContent from '@/components/ui/CardContent.vue'

const { t } = useI18n()

// --- Telegram credentials ---
const apiId = ref('')
const apiHash = ref('')
const hasApiHash = ref(false)
const saving = ref(false)
const saveResult = ref('')

async function loadSettings() {
  const s = await api.getSettings()
  apiId.value = s.apiId ?? ''
  hasApiHash.value = s.hasApiHash
}

onMounted(loadSettings)

async function saveCreds() {
  saving.value = true
  saveResult.value = ''
  try {
    const body: { apiId?: string; apiHash?: string } = {}
    if (apiId.value.trim()) body.apiId = apiId.value.trim()
    if (apiHash.value.trim()) body.apiHash = apiHash.value.trim()
    const s = await api.updateSettings(body)
    hasApiHash.value = s.hasApiHash
    apiHash.value = ''
    saveResult.value = t('settings.saved')
  } catch (e) {
    saveResult.value = e instanceof Error ? e.message : t('settings.saveFailed')
  } finally {
    saving.value = false
  }
}

// --- API key test ---
const apiKey = ref('')
const result = ref('')

async function check() {
  result.value = ''
  try {
    const res = await api.apiKeyCheck(apiKey.value)
    result.value = res.ok ? t('apiKey.valid') : t('apiKey.invalid')
  } catch {
    result.value = t('apiKey.invalid')
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('settings.title') }}</h1>
      <p class="text-sm text-muted-foreground">{{ t('settings.subtitle') }}</p>
    </div>

    <div class="grid gap-4 md:grid-cols-2 md:items-start">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <Send class="h-4 w-4" /> {{ t('settings.telegramTitle') }}
          </CardTitle>
          <CardDescription>{{ t('settings.telegramDesc') }}</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4">
          <div class="grid gap-2">
            <Label for="apiId">api_id</Label>
            <Input id="apiId" v-model="apiId" inputmode="numeric" placeholder="123456" />
          </div>
          <div class="grid gap-2">
            <Label for="apiHash">api_hash</Label>
            <Input
              id="apiHash"
              v-model="apiHash"
              :placeholder="hasApiHash ? '••••••••' : '0123456789abcdef...'"
            />
            <p v-if="hasApiHash" class="text-xs text-muted-foreground">
              {{ t('settings.apiHashSet') }}
            </p>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t('settings.credsHint') }}
            <a
              href="https://my.telegram.org"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-primary underline underline-offset-2 hover:opacity-80"
            >
              my.telegram.org
            </a>
            → API development tools.
          </p>
          <div class="flex items-center gap-3">
            <Button :disabled="saving" @click="saveCreds">
              {{ saving ? t('settings.saving') : t('settings.save') }}
            </Button>
            <span class="text-sm text-muted-foreground">{{ saveResult }}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <KeyRound class="h-4 w-4" /> {{ t('apiKey.cardTitle') }}
          </CardTitle>
          <CardDescription>{{ t('settings.apiKeyDesc') }}</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-3">
          <div class="grid gap-2">
            <Label for="apikey">x-api-key</Label>
            <Input id="apikey" v-model="apiKey" placeholder="API key" />
          </div>
          <div class="flex items-center gap-3">
            <Button @click="check">{{ t('apiKey.verify') }}</Button>
            <span class="text-sm">{{ result }}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
