<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
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
const serverError = ref('')
const submitting = ref(false)
const logoUrl = `${import.meta.env.BASE_URL}logo.png`

const schema = toTypedSchema(
  z.object({
    username: z.string().min(1, t('validation.userOrEmail')),
    password: z.string().min(8, t('validation.min', { n: 8 })),
  }),
)
const { handleSubmit, errors, defineField } = useForm({ validationSchema: schema })
const [username, usernameAttrs] = defineField('username')
const [password, passwordAttrs] = defineField('password')

const onSubmit = handleSubmit(async (values) => {
  serverError.value = ''
  submitting.value = true
  try {
    await auth.login(values)
    const redirect = route.query.redirect
    await router.push(typeof redirect === 'string' ? redirect : { name: 'overview' })
  } catch (e) {
    serverError.value = e instanceof Error ? e.message : t('login.failed')
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center bg-muted/30 p-4">
    <div class="absolute right-4 top-4">
      <AppControls />
    </div>
    <Card class="w-full max-w-sm">
      <CardHeader class="items-center text-center">
        <img :src="logoUrl" alt="Flux" class="mb-2 h-12 w-auto" />
        <CardTitle>{{ t('login.title') }}</CardTitle>
        <CardDescription>{{ t('login.subtitle') }}</CardDescription>
      </CardHeader>
      <form @submit="onSubmit">
        <CardContent class="grid gap-4">
          <div class="grid gap-2">
            <Label for="username">{{ t('login.userOrEmail') }}</Label>
            <Input id="username" v-model="username" v-bind="usernameAttrs" placeholder="flux_user" />
            <p v-if="errors.username" class="text-xs text-destructive">{{ errors.username }}</p>
          </div>
          <div class="grid gap-2">
            <Label for="password">{{ t('login.password') }}</Label>
            <Input id="password" v-model="password" v-bind="passwordAttrs" type="password" />
            <p v-if="errors.password" class="text-xs text-destructive">{{ errors.password }}</p>
          </div>
          <p v-if="serverError" class="text-sm text-destructive">{{ serverError }}</p>
        </CardContent>
        <CardFooter>
          <Button type="submit" class="w-full" :disabled="submitting">
            {{ submitting ? t('login.submitting') : t('login.submit') }}
          </Button>
        </CardFooter>
      </form>
    </Card>
  </div>
</template>
