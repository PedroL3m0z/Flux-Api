<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { Plus, UserPlus, X } from 'lucide-vue-next'
import { api, type UserListItem } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardDescription from '@/components/ui/CardDescription.vue'
import CardContent from '@/components/ui/CardContent.vue'

const users = ref<UserListItem[]>([])
const listError = ref('')
const loading = ref(false)

async function loadUsers() {
  loading.value = true
  listError.value = ''
  try {
    users.value = await api.users()
  } catch (e) {
    listError.value = e instanceof Error ? e.message : 'Falha ao listar'
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR')
}

// Create modal
const showCreate = ref(false)
const formError = ref('')
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

function openCreate() {
  formError.value = ''
  resetForm()
  showCreate.value = true
}

const onSubmit = handleSubmit(async (values) => {
  formError.value = ''
  creating.value = true
  try {
    await api.register(values)
    showCreate.value = false
    await loadUsers()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Falha ao criar'
  } finally {
    creating.value = false
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p class="text-sm text-muted-foreground">Todas as contas cadastradas.</p>
      </div>
      <Button @click="openCreate">
        <Plus class="h-4 w-4" /> Cadastrar usuário
      </Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-left text-muted-foreground">
              <th class="px-4 py-3 font-medium">Usuário</th>
              <th class="px-4 py-3 font-medium">Email</th>
              <th class="px-4 py-3 font-medium">Criado em</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="3" class="px-4 py-6 text-center text-muted-foreground">
                Carregando...
              </td>
            </tr>
            <tr v-else-if="listError">
              <td colspan="3" class="px-4 py-6 text-center text-destructive">
                {{ listError }}
              </td>
            </tr>
            <tr v-else-if="!users.length">
              <td colspan="3" class="px-4 py-6 text-center text-muted-foreground">
                Nenhum usuário.
              </td>
            </tr>
            <tr
              v-for="u in users"
              :key="u.id"
              class="border-b last:border-0 hover:bg-muted/40"
            >
              <td class="px-4 py-3 font-medium">{{ u.username }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ u.email }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ fmtDate(u.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>

    <!-- Create modal -->
    <Teleport to="body">
      <div
        v-if="showCreate"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="showCreate = false"
      >
        <Card class="w-full max-w-md">
          <CardHeader class="flex-row items-start justify-between">
            <div>
              <CardTitle class="flex items-center gap-2 text-base">
                <UserPlus class="h-4 w-4" /> Cadastrar usuário
              </CardTitle>
              <CardDescription>Cria uma nova conta.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" @click="showCreate = false">
              <X class="h-4 w-4" />
            </Button>
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
              <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
              <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" @click="showCreate = false">
                  Cancelar
                </Button>
                <Button type="submit" :disabled="creating">
                  {{ creating ? 'Criando...' : 'Criar' }}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Teleport>
  </div>
</template>
