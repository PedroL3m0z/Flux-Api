import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  api,
  clearApiKey,
  hasApiKey,
  setApiKey,
  type Credentials,
  type SafeUser,
} from '@/lib/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SafeUser | null>(null)
  const initialized = ref(false)
  const apiKeyReady = ref(hasApiKey())

  /** True once the user is logged in AND has supplied a valid API key. */
  const unlocked = computed(() => !!user.value && apiKeyReady.value)

  /** Restore the session from the httpOnly cookie (called once at startup). */
  async function init() {
    if (initialized.value) return
    try {
      user.value = await api.me()
    } catch {
      user.value = null
    }
    // Validate any persisted API key; drop it if the server rejects it.
    if (user.value && hasApiKey()) {
      try {
        const res = await api.apiKeyCheck(getStoredKey())
        if (!res.ok) forgetApiKey()
      } catch {
        forgetApiKey()
      }
    }
    apiKeyReady.value = hasApiKey()
    initialized.value = true
  }

  async function login(credentials: Credentials) {
    await api.login(credentials)
    user.value = await api.me()
  }

  /** Validates and stores the API key. Returns false if the key is invalid. */
  async function submitApiKey(key: string): Promise<boolean> {
    try {
      const res = await api.apiKeyCheck(key)
      if (!res.ok) return false
    } catch {
      return false
    }
    setApiKey(key)
    apiKeyReady.value = true
    return true
  }

  function forgetApiKey() {
    clearApiKey()
    apiKeyReady.value = false
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      user.value = null
      forgetApiKey()
    }
  }

  return {
    user,
    initialized,
    apiKeyReady,
    unlocked,
    init,
    login,
    submitApiKey,
    forgetApiKey,
    logout,
  }
})

/** Reads the raw stored key for re-validation (kept out of the public store API). */
function getStoredKey(): string {
  return localStorage.getItem('flux-api-key') ?? ''
}
