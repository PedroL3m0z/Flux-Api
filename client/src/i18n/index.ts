import { createI18n } from 'vue-i18n'
import en from './locales/en'
import ptBR from './locales/pt-BR'

export const SUPPORTED_LOCALES = [
  { code: 'pt-BR', label: 'Português' },
  { code: 'en', label: 'English' },
] as const

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]['code']

const saved = localStorage.getItem('locale') as LocaleCode | null

export const i18n = createI18n({
  legacy: false,
  locale: saved ?? 'pt-BR',
  fallbackLocale: 'en',
  messages: { en, 'pt-BR': ptBR },
})

export function setLocale(code: LocaleCode) {
  i18n.global.locale.value = code
  localStorage.setItem('locale', code)
  document.documentElement.setAttribute('lang', code)
}
