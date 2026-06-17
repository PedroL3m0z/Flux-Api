<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { UserPlus } from 'lucide-vue-next'
import { api } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardDescription from '@/components/ui/CardDescription.vue'
import CardContent from '@/components/ui/CardContent.vue'

const msg = ref('')
const err = ref('')
const creating = ref(false)

const schema = toTypedSchema(
  z.object({
    email: z.string().email('Email inválido'),
    username: z.string().min(3, 'Mínimo 3').max(32, 'Máximo 32'),
    password: z.string().min(8, 'Mínimo 8').max(128, 'Máximo 128'),
  }),
)
const { handleSubmit, errors, defineField, resetForm } = useForm({
  validationSchema: schema,
})
const [email, emailAttrs] = defineField('email')
const [username, usernameAttrs] = defineField('username')
const [password, passwordAttrs] = defineField('password')

const onSubmit = handleSubmit(async (values) => {
  msg.value = ''
  err.value = ''
  creating.value = true
  try {
    const u = await api.register(values)
    msg.value = `Usuário "${u.username}" criado`
    resetForm()
  } catch (e) {
    err.value = e instanceof Error ? e.message : 'Falha ao criar'
  } finally {
    creating.value = false
  }
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Usuários</h1>
      <p class="text-sm text-muted-foreground">Cadastre novas contas.</p>
    </div>
    <Card class="max-w-lg">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-base">
          <UserPlus class="h-4 w-4" /> Criar usuário
        </CardTitle>
        <CardDescription>Requer estar autenticado.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="grid gap-4" @submit="onSubmit">
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
          <div class="flex items-center gap-3">
            <Button type="submit" :disabled="creating">
              {{ creating ? 'Criando...' : 'Criar' }}
            </Button>
            <span v-if="msg" class="text-sm text-primary">{{ msg }}</span>
            <span v-if="err" class="text-sm text-destructive">{{ err }}</span>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
