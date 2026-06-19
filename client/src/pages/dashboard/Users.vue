<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Pencil, Plus, ShieldCheck, Trash2, UserPlus, X } from 'lucide-vue-next'
import { api, type UserRole, type UserListItem } from '@/lib/api'
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

const DASHBOARD_ROLES: UserRole[] = ['admin', 'operator', 'viewer']

// --- Edit ---
const showEdit = ref(false)
const saving = ref(false)
const editId = ref('')
const editEmail = ref('')
const editUsername = ref('')
const editPassword = ref('')
const editRole = ref<UserRole>('viewer')

function openEdit(u: UserListItem) {
  editId.value = u.id
  editEmail.value = u.email
  editUsername.value = u.username
  editPassword.value = ''
  editRole.value = u.role
  showEdit.value = true
}

async function submitEdit() {
  saving.value = true
  try {
    const body: {
      email?: string
      username?: string
      password?: string
      role?: UserRole
    } = {
      email: editEmail.value.trim(),
      username: editUsername.value.trim(),
      role: editRole.value,
    }
    if (editPassword.value) body.password = editPassword.value
    const updated = await api.updateUser(editId.value, body)
    const idx = users.value.findIndex((u) => u.id === updated.id)
    if (idx !== -1) users.value[idx] = updated
    showEdit.value = false
    toast.success(t('users.updated'))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('users.updateFailed'))
  } finally {
    saving.value = false
  }
}

async function removeUser(u: UserListItem) {
  if (!window.confirm(t('users.confirmDelete', { name: u.username }))) return
  try {
    await api.deleteUser(u.id)
    users.value = users.value.filter((x) => x.id !== u.id)
    toast.success(t('users.deleted'))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('users.deleteFailed'))
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
                  :class="{
                    'bg-primary/10 text-primary': u.role === 'admin',
                    'bg-amber-500/10 text-amber-700': u.role === 'operator',
                    'bg-muted text-muted-foreground': u.role === 'viewer',
                  }"
                >
                  <ShieldCheck v-if="u.role === 'admin'" class="h-3 w-3" />
                  {{ t(`roles.${u.role}`) }}
                </span>
              </td>
              <td class="px-4 py-3 text-muted-foreground">{{ fmtDate(u.createdAt) }}</td>
              <td v-if="auth.isAdmin" class="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  :title="t('common.edit')"
                  @click="openEdit(u)"
                >
                  <Pencil class="h-4 w-4" />
                </Button>
                <Button
                  v-if="u.id !== auth.user?.id"
                  variant="ghost"
                  size="icon"
                  :title="t('users.delete')"
                  @click="removeUser(u)"
                >
                  <Trash2 class="h-4 w-4 text-destructive" />
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

    <Teleport to="body">
      <div
        v-if="showEdit"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="showEdit = false"
      >
        <Card class="w-full max-w-md">
          <CardHeader class="flex-row items-start justify-between">
            <div>
              <CardTitle class="flex items-center gap-2 text-base">
                <Pencil class="h-4 w-4" /> {{ t('users.editTitle') }}
              </CardTitle>
              <CardDescription>{{ t('users.editDesc') }}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" @click="showEdit = false">
              <X class="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form class="grid gap-4" @submit.prevent="submitEdit">
              <div class="grid gap-2">
                <Label for="edit-email">{{ t('fields.email') }}</Label>
                <Input id="edit-email" v-model="editEmail" type="email" />
              </div>
              <div class="grid gap-2">
                <Label for="edit-username">{{ t('fields.username') }}</Label>
                <Input id="edit-username" v-model="editUsername" />
              </div>
              <div class="grid gap-2">
                <Label for="edit-password">{{ t('fields.password') }}</Label>
                <Input
                  id="edit-password"
                  v-model="editPassword"
                  type="password"
                  autocomplete="new-password"
                  :placeholder="t('users.passwordKeep')"
                />
              </div>
              <div class="grid gap-2">
                <Label for="edit-role">{{ t('users.colRole') }}</Label>
                <select
                  id="edit-role"
                  v-model="editRole"
                  class="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option v-for="r in DASHBOARD_ROLES" :key="r" :value="r">
                    {{ t(`roles.${r}`) }}
                  </option>
                </select>
              </div>
              <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" @click="showEdit = false">
                  {{ t('common.cancel') }}
                </Button>
                <Button type="submit" :disabled="saving">
                  {{ saving ? t('common.loading') : t('common.save') }}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Teleport>
  </div>
</template>
