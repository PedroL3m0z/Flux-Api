<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Plus, ShieldCheck, UserPlus, X } from 'lucide-vue-next'
import { api, type GlobalRole, type UserListItem } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardDescription from '@/components/ui/CardDescription.vue'
import CardContent from '@/components/ui/CardContent.vue'

const { t, locale } = useI18n()
const auth = useAuthStore()
const users = ref<UserListItem[]>([])
const listError = ref('')
const loading = ref(false)

async function toggleRole(u: UserListItem) {
  const next: GlobalRole = u.role === 'admin' ? 'member' : 'admin'
  try {
    const updated = await api.setUserRole(u.id, next)
    u.role = updated.role
    toast.success(t('users.roleUpdated'))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('users.roleFailed'))
  }
}

async function loadUsers() {
  loading.value = true
  listError.value = ''
  try {
    users.value = await api.users()
  } catch (e) {
    listError.value = e instanceof Error ? e.message : t('users.listError')
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(locale.value)
}

const showCreate = ref(false)
const creating = ref(false)

const schema = toTypedSchema(
  z.object({
    email: z.string().email(t('validation.email')),
    username: z
      .string()
      .min(3, t('validation.min', { n: 3 }))
      .max(32, t('validation.max', { n: 32 })),
    password: z
      .string()
      .min(8, t('validation.min', { n: 8 }))
      .max(128, t('validation.max', { n: 128 })),
  }),
)
const { handleSubmit, errors, defineField, resetForm } = useForm({
  validationSchema: schema,
})
const [email, emailAttrs] = defineField('email')
const [username, usernameAttrs] = defineField('username')
const [password, passwordAttrs] = defineField('password')

function openCreate() {
  resetForm()
  showCreate.value = true
}

const onSubmit = handleSubmit(async (values) => {
  creating.value = true
  try {
    await api.register(values)
    showCreate.value = false
    await loadUsers()
    toast.success(t('users.created'))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('users.createFailed'))
  } finally {
    creating.value = false
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ t('users.title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('users.subtitle') }}</p>
      </div>
      <Button @click="openCreate">
        <Plus class="h-4 w-4" /> {{ t('users.add') }}
      </Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-left text-muted-foreground">
              <th class="px-4 py-3 font-medium">{{ t('users.colUser') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('users.colEmail') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('users.colRole') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('users.colCreated') }}</th>
              <th v-if="auth.isAdmin" class="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td :colspan="auth.isAdmin ? 5 : 4" class="px-4 py-6 text-center text-muted-foreground">
                {{ t('common.loading') }}
              </td>
            </tr>
            <tr v-else-if="listError">
              <td :colspan="auth.isAdmin ? 5 : 4" class="px-4 py-6 text-center text-destructive">
                {{ listError }}
              </td>
            </tr>
            <tr v-else-if="!users.length">
              <td :colspan="auth.isAdmin ? 5 : 4" class="px-4 py-6 text-center text-muted-foreground">
                {{ t('users.empty') }}
              </td>
            </tr>
            <tr
              v-for="u in users"
              :key="u.id"
              class="border-b last:border-0 hover:bg-muted/40"
            >
              <td class="px-4 py-3 font-medium">{{ u.username }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ u.email }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="u.role === 'admin'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'"
                >
                  <ShieldCheck v-if="u.role === 'admin'" class="h-3 w-3" />
                  {{ t(`roles.${u.role}`) }}
                </span>
              </td>
              <td class="px-4 py-3 text-muted-foreground">{{ fmtDate(u.createdAt) }}</td>
              <td v-if="auth.isAdmin" class="px-4 py-3 text-right">
                <Button
                  v-if="u.id !== auth.user?.id"
                  variant="outline"
                  size="sm"
                  @click="toggleRole(u)"
                >
                  {{ u.role === 'admin' ? t('users.demote') : t('users.promote') }}
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>

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
                <UserPlus class="h-4 w-4" /> {{ t('users.modalTitle') }}
              </CardTitle>
              <CardDescription>{{ t('users.modalDesc') }}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" @click="showCreate = false">
              <X class="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form class="grid gap-4" @submit="onSubmit">
              <div class="grid gap-2">
                <Label for="email">{{ t('fields.email') }}</Label>
                <Input id="email" v-model="email" v-bind="emailAttrs" type="email" placeholder="user@flux.dev" />
                <p v-if="errors.email" class="text-xs text-destructive">{{ errors.email }}</p>
              </div>
              <div class="grid gap-2">
                <Label for="username">{{ t('fields.username') }}</Label>
                <Input id="username" v-model="username" v-bind="usernameAttrs" placeholder="flux_user" />
                <p v-if="errors.username" class="text-xs text-destructive">{{ errors.username }}</p>
              </div>
              <div class="grid gap-2">
                <Label for="password">{{ t('fields.password') }}</Label>
                <Input id="password" v-model="password" v-bind="passwordAttrs" type="password" />
                <p v-if="errors.password" class="text-xs text-destructive">{{ errors.password }}</p>
              </div>
              <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" @click="showCreate = false">
                  {{ t('common.cancel') }}
                </Button>
                <Button type="submit" :disabled="creating">
                  {{ creating ? t('common.creating') : t('common.create') }}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Teleport>
  </div>
</template>
