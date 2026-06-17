import { ref } from 'vue'

type Theme = 'light' | 'dark'

const theme = ref<Theme>('light')

function apply(value: Theme) {
  document.documentElement.classList.toggle('dark', value === 'dark')
}

/** Call once at startup to restore the saved/system theme before mount. */
export function initTheme() {
  const saved = localStorage.getItem('theme') as Theme | null
  const system = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
  theme.value = saved ?? system
  apply(theme.value)
}

export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', theme.value)
    apply(theme.value)
  }
  return { theme, toggle }
}
