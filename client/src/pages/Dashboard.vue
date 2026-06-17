<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { Activity, KeyRound, LogOut, User, UserPlus } from 'lucide-vue-next'
import { api, type HealthResult } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardDescription from '@/components/ui/CardDescription.vue'
import CardContent from '@/components/ui/CardContent.vue'

const auth = useAuthStore()
const router = useRouter()
const logoUrl = `${import.meta.env.BASE_URL}logo.png`

const health = ref<HealthResult | null>(null)
const healthError = ref('')
const apiKey = ref('')
const apiKeyResult = ref('')

onMounted(async () => {
  try {
    health.value = await api.health()
  } catch (e) {
    healthError.value = e instanceof Error ? e.message : 'Indisponível'
  }
})

async function checkApiKey() {
  apiKeyResult.value = ''
  try {
    const res = await api.apiKeyCheck(apiKey.value)
    apiKeyResult.value = res.ok ? '✅ Chave válida' : '❌ Inválida'
  } catch {
    apiKeyResult.value = '❌ Chave inválida'
  }
}

// Create user (authenticated; only logged-in users can create accounts).
const createMsg = ref('')
const createErr = ref('')
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
const [newUsername, usernameAttrs] = defineField('username')
const [password, passwordAttrs] = defineField('password')

const onCreate = handleSubmit(async (values) => {
  createMsg.value = ''
  createErr.value = ''
  creating.value = true
  try {
    const u = await api.register(values)
    createMsg.value = `Usuário "${u.username}" criado`
    resetForm()
  } catch (e) {
    createErr.value = e instanceof Error ? e.message : 'Falha ao criar'
  } finally {
    creating.value = false
  }
})

async function onLogout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen bg-muted/30">
    <header class="border-b bg-card">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div class="flex items-center gap-2">
          <img :src="logoUrl" alt="Flux" class="h-8 w-auto" />
          <span class="font-semibold">Dashboard</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted-foreground">{{ auth.user?.username }}</span>
          <Button variant="outline" size="sm" @click="onLogout">
            <LogOut class="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    </header>

    <main class="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <User class="h-4 w-4" /> Conta
          </CardTitle>
          <CardDescription>Usuário autenticado (JWT via cookie)</CardDescription>
        </CardHeader>
        <CardContent class="space-y-1 text-sm">
          <p><span class="text-muted-foreground">ID:</span> {{ auth.user?.id }}</p>
          <p><span class="text-muted-foreground">Usuário:</span> {{ auth.user?.username }}</p>
          <p><span class="text-muted-foreground">Email:</span> {{ auth.user?.email }}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <Activity class="h-4 w-4" /> Saúde
          </CardTitle>
          <CardDescription>Postgres · Redis · Memória</CardDescription>
        </CardHeader>
        <CardContent class="space-y-1 text-sm">
          <p v-if="healthError" class="text-destructive">{{ healthError }}</p>
          <template v-else-if="health">
            <p><span class="text-muted-foreground">Status:</span> {{ health.status }}</p>
            <p v-for="(v, k) in health.info" :key="k">
              <span class="text-muted-foreground">{{ k }}:</span> {{ v.status }}
            </p>
          </template>
          <p v-else class="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>

      <Card class="md:col-span-2">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <UserPlus class="h-4 w-4" /> Criar usuário
          </CardTitle>
          <CardDescription>Cadastra uma nova conta (requer estar logado)</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="grid gap-4 sm:grid-cols-3" @submit="onCreate">
            <div class="grid gap-2">
              <Label for="c-email">Email</Label>
              <Input id="c-email" v-model="email" v-bind="emailAttrs" type="email" placeholder="user@flux.dev" />
              <p v-if="errors.email" class="text-xs text-destructive">{{ errors.email }}</p>
            </div>
            <div class="grid gap-2">
              <Label for="c-username">Usuário</Label>
              <Input id="c-username" v-model="newUsername" v-bind="usernameAttrs" placeholder="flux_user" />
              <p v-if="errors.username" class="text-xs text-destructive">{{ errors.username }}</p>
            </div>
            <div class="grid gap-2">
              <Label for="c-password">Senha</Label>
              <Input id="c-password" v-model="password" v-bind="passwordAttrs" type="password" />
              <p v-if="errors.password" class="text-xs text-destructive">{{ errors.password }}</p>
            </div>
            <div class="sm:col-span-3 flex items-center gap-3">
              <Button type="submit" :disabled="creating">
                {{ creating ? 'Criando...' : 'Criar' }}
              </Button>
              <span v-if="createMsg" class="text-sm text-primary">{{ createMsg }}</span>
              <span v-if="createErr" class="text-sm text-destructive">{{ createErr }}</span>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card class="md:col-span-2">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <KeyRound class="h-4 w-4" /> Testar API Key
          </CardTitle>
          <CardDescription>Chama GET /auth/api-key-check com x-api-key</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div class="grid flex-1 gap-2">
            <Label for="apikey">x-api-key</Label>
            <Input id="apikey" v-model="apiKey" placeholder="sua API key" />
          </div>
          <Button @click="checkApiKey">Verificar</Button>
          <span class="text-sm">{{ apiKeyResult }}</span>
        </CardContent>
      </Card>
    </main>
  </div>
</template>
