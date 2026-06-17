import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, type Credentials, type SafeUser } from '@/lib/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SafeUser | null>(null)
  const initialized = ref(false)

  /** Restore the session from the httpOnly cookie (called once at startup). */
  async function init() {
    if (initialized.value) return
    try {
      user.value = await api.me()
    } catch {
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function login(credentials: Credentials) {
    await api.login(credentials)
    user.value = await api.me()
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      user.value = null
    }
  }

  return { user, initialized, init, login, logout }
})
