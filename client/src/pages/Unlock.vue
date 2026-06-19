<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { KeyRound, LogOut } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardDescription from '@/components/ui/CardDescription.vue'
import CardContent from '@/components/ui/CardContent.vue'
import CardFooter from '@/components/ui/CardFooter.vue'
import AppControls from '@/components/AppControls.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const key = ref('')
const submitting = ref(false)

async function onSubmit() {
  if (!key.value.trim() || submitting.value) return
  submitting.value = true
  try {
    const ok = await auth.submitApiKey(key.value.trim())
    if (!ok) {
      toast.error(t('unlock.invalid'))
      return
    }
    toast.success(t('unlock.unlocked'))
    const redirect = route.query.redirect
    await router.push(typeof redirect === 'string' ? redirect : { name: 'overview' })
  } finally {
    submitting.value = false
  }
}

async function onLogout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center bg-muted/30 p-4">
    <div class="absolute right-4 top-4">
      <AppControls />
    </div>
    <Card class="w-full max-w-sm">
      <CardHeader class="items-center text-center">
        <div class="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <KeyRound class="h-6 w-6 text-primary" />
        </div>
        <CardTitle>{{ t('unlock.title') }}</CardTitle>
        <CardDescription>{{ t('unlock.subtitle') }}</CardDescription>
      </CardHeader>
      <form @submit.prevent="onSubmit">
        <CardContent class="grid gap-4">
          <div class="grid gap-2">
            <Label for="apikey">x-api-key</Label>
            <Input
              id="apikey"
              v-model="key"
              type="password"
              autofocus
              :placeholder="t('unlock.placeholder')"
            />
          </div>
        </CardContent>
        <CardFooter class="flex-col gap-2">
          <Button type="submit" class="w-full" :disabled="submitting">
            {{ submitting ? t('unlock.submitting') : t('unlock.submit') }}
          </Button>
          <Button type="button" variant="ghost" class="w-full" @click="onLogout">
            <LogOut class="h-4 w-4" /> {{ t('nav.logout') }}
          </Button>
        </CardFooter>
      </form>
    </Card>
  </div>
</template>
