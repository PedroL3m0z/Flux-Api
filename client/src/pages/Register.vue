<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { useRouter } from 'vue-router'
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

const auth = useAuthStore()
const router = useRouter()
const serverError = ref('')
const submitting = ref(false)
const logoUrl = `${import.meta.env.BASE_URL}logo.png`

const schema = toTypedSchema(
  z.object({
    email: z.string().email('Email inválido'),
    username: z
      .string()
      .min(3, 'Mínimo 3 caracteres')
      .max(32, 'Máximo 32 caracteres'),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(128, 'Máximo 128 caracteres'),
  }),
)
const { handleSubmit, errors, defineField } = useForm({ validationSchema: schema })
const [email, emailAttrs] = defineField('email')
const [username, usernameAttrs] = defineField('username')
const [password, passwordAttrs] = defineField('password')

const onSubmit = handleSubmit(async (values) => {
  serverError.value = ''
  submitting.value = true
  try {
    await auth.register(values)
    await router.push({ name: 'dashboard' })
  } catch (e) {
    serverError.value = e instanceof Error ? e.message : 'Falha no registro'
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-muted/30 p-4">
    <Card class="w-full max-w-sm">
      <CardHeader class="items-center text-center">
        <img :src="logoUrl" alt="Flux" class="mb-2 h-12 w-auto" />
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Flux API Gateway</CardDescription>
      </CardHeader>
      <form @submit="onSubmit">
        <CardContent class="grid gap-4">
          <div class="grid gap-2">
            <Label for="email">Email</Label>
            <Input id="email" v-model="email" v-bind="emailAttrs" type="email" placeholder="user@flux.dev" />
            <p v-if="errors.email" class="text-xs text-destructive">{{ errors.email }}</p>
          </div>
          <div class="grid gap-2">
            <Label for="username">Usuário</Label>
            <Input id="username" v-model="username" v-bind="usernameAttrs" placeholder="flux_user" />
            <p v-if="errors.username" class="text-xs text-destructive">{{ errors.username }}</p>
          </div>
          <div class="grid gap-2">
            <Label for="password">Senha</Label>
            <Input id="password" v-model="password" v-bind="passwordAttrs" type="password" />
            <p v-if="errors.password" class="text-xs text-destructive">{{ errors.password }}</p>
          </div>
          <p v-if="serverError" class="text-sm text-destructive">{{ serverError }}</p>
        </CardContent>
        <CardFooter class="flex-col gap-3">
          <Button type="submit" class="w-full" :disabled="submitting">
            {{ submitting ? 'Criando...' : 'Criar conta' }}
          </Button>
          <p class="text-sm text-muted-foreground">
            Já tem conta?
            <RouterLink to="/login" class="font-medium text-primary hover:underline">
              Entrar
            </RouterLink>
          </p>
        </CardFooter>
      </form>
    </Card>
  </div>
</template>
