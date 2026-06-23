<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { 
  ArrowRight, 
  Mail, 
  Lock, 
  User, 
  Bot,
  Activity,
  Globe
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import AppControls from '@/components/AppControls.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const activeTab = ref<'login' | 'register'>('login')
const logoUrl = `${import.meta.env.BASE_URL}logo.png`

// Social Login Alert
const socialAlert = ref('')
function triggerSocialLogin(provider: string) {
  socialAlert.value = `O login social com ${provider} não está configurado. Por favor, utilize credenciais locais.`
  setTimeout(() => {
    socialAlert.value = ''
  }, 4000)
}

// --- Login Form Logic ---
const serverError = ref('')
const submitting = ref(false)

const schema = toTypedSchema(
  z.object({
    username: z.string().min(1, t('validation.userOrEmail')),
    password: z.string().min(8, t('validation.min', { n: 8 })),
  }),
)
const { handleSubmit, errors, defineField } = useForm({ validationSchema: schema })
const [username, usernameAttrs] = defineField('username')
const [password, passwordAttrs] = defineField('password')

const onLoginSubmit = handleSubmit(async (values) => {
  serverError.value = ''
  submitting.value = true
  try {
    await auth.login(values)
    const redirect = route.query.redirect
    await router.push(typeof redirect === 'string' ? redirect : { name: 'overview' })
  } catch (e) {
    serverError.value = e instanceof Error ? e.message : t('login.failed')
  } finally {
    submitting.value = false
  }
})

// --- Register Form Logic ---
const regEmail = ref('')
const regUsername = ref('')
const regPassword = ref('')
const regPasswordConfirm = ref('')
const regError = ref('')
const registering = ref(false)
const regSuccess = ref(false)

async function onRegisterSubmit() {
  regError.value = ''
  regSuccess.value = false

  if (!regEmail.value || !regEmail.value.includes('@')) {
    regError.value = t('validation.email')
    return
  }
  if (!regUsername.value || regUsername.value.length < 3) {
    regError.value = t('validation.min', { n: 3 })
    return
  }
  if (!regPassword.value || regPassword.value.length < 8) {
    regError.value = t('validation.min', { n: 8 })
    return
  }
  if (regPassword.value !== regPasswordConfirm.value) {
    regError.value = 'As senhas informadas não coincidem.'
    return
  }

  registering.value = true
  try {
    // 1. Call API endpoint to register
    await api.register({
      email: regEmail.value,
      username: regUsername.value,
      password: regPassword.value,
    })

    regSuccess.value = true
    
    // 2. Automatically log in the user after register
    await auth.login({
      username: regUsername.value,
      password: regPassword.value,
    })

    // 3. Redirect
    const redirect = route.query.redirect
    await router.push(typeof redirect === 'string' ? redirect : { name: 'overview' })
  } catch (e) {
    regError.value = e instanceof Error ? e.message : 'Falha ao cadastrar usuário.'
  } finally {
    registering.value = false
  }
}

function switchTab(tab: 'login' | 'register') {
  activeTab.value = tab
  serverError.value = ''
  regError.value = ''
  socialAlert.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative overflow-hidden font-sans">
    
    <!-- LEFT SIDE: Modern branding, grid bg & mock connection status -->
    <section class="w-full lg:w-[48%] bg-[#080d1a] relative overflow-hidden grid-bg flex flex-col justify-between p-8 sm:p-12 lg:min-h-screen border-b lg:border-b-0 lg:border-r border-slate-900 z-10 shrink-0">
      <!-- Glow effect inside left panel -->
      <div class="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/10 glow-orb animate-pulse-slow pointer-events-none" />
      <div class="absolute bottom-20 -right-20 w-[400px] h-[400px] rounded-full bg-indigo-500/10 glow-orb pointer-events-none" />
      
      <!-- Top header branding -->
      <div class="relative z-10 flex items-center justify-between">
        <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2 group">
          <img :src="logoUrl" alt="Flux Logo" class="h-9 w-auto filter drop-shadow-[0_0_8px_rgba(99,102,241,0.3)] transition-transform duration-300 group-hover:scale-105" />
        </RouterLink>
        <AppControls />
      </div>

      <!-- Center content: connection card & core value proposition -->
      <div class="relative z-10 my-12 lg:my-auto max-w-lg mx-auto lg:mx-0">
        <!-- Floating simulated Glassmorphic Dashboard Card -->
        <div class="glass-card rounded-2xl p-6 mb-8 border border-white/10 shadow-2xl relative overflow-hidden transition-all duration-500 hover:scale-[1.01]">
          <div class="absolute inset-0 bg-gradient-to-tr from-primary/5 to-indigo-500/5 pointer-events-none" />
          
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 text-primary">
                <Bot class="h-5 w-5 animate-bounce" />
              </div>
              <div>
                <h4 class="text-sm font-bold text-slate-100">Flux Active Gateway</h4>
                <p class="text-[11px] text-slate-400 flex items-center gap-1">
                  <span class="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Conexão ativa
                </p>
              </div>
            </div>
            <span class="text-[9px] tracking-wider uppercase bg-primary/20 border border-primary/40 px-2 py-0.5 rounded text-primary-300 font-bold">
              Online
            </span>
          </div>

          <!-- Progress and analytics simulation -->
          <div class="space-y-4">
            <div>
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Vazão de Mensagens</span>
                <span class="font-bold text-slate-200">1.240 / 5.000 msgs</span>
              </div>
              <div class="h-2 w-full rounded-full bg-slate-900/60 overflow-hidden border border-white/5">
                <div class="h-full rounded-full bg-gradient-to-r from-primary to-indigo-500 w-[65%] transition-all duration-1000" />
              </div>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-slate-400">
              <span class="flex items-center gap-1">
                <Activity class="h-3 w-3 text-cyan-400" /> API: 14ms
              </span>
              <span class="flex items-center gap-1">
                <Globe class="h-3 w-3 text-indigo-400" /> Webhooks: OK
              </span>
              <span>Uptime: 99.9%</span>
            </div>
          </div>
        </div>

        <!-- Copy and Text content -->
        <h2 class="text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
          Seu fluxo de automação <br />
          <span class="bg-gradient-to-r from-primary-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">começa aqui.</span>
        </h2>
        <p class="mt-4 text-sm text-slate-400 leading-relaxed max-w-md">
          Conecte instâncias do Telegram em segundos, monitore conversas em tempo real e envie mídia de forma programada com controle total do gateway HTTP.
        </p>
      </div>

      <!-- Bottom page references -->
      <div class="relative z-10 flex items-center justify-between text-xs text-slate-500 pt-6">
        <div class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-slate-600" />
          <span class="w-1.5 h-1.5 rounded-full bg-slate-600" />
          <span class="w-3 h-1.5 rounded-full bg-primary" />
        </div>
        <RouterLink :to="{ name: 'home' }" class="hover:text-slate-300 transition-colors">
          {{ t('login.backHome') }}
        </RouterLink>
      </div>
    </section>

    <!-- RIGHT SIDE: Deep Slate / Form block -->
    <section class="w-full lg:w-[52%] bg-[#0a0f1d] flex items-center justify-center p-6 sm:p-12 lg:p-20 relative overflow-hidden">
      <!-- Glow orb behind form -->
      <div class="absolute -bottom-40 -right-20 w-[450px] h-[450px] rounded-full bg-indigo-500/5 glow-orb pointer-events-none" />
      
      <div class="w-full max-w-md z-10">
        <!-- Title and toggle tabs -->
        <div class="mb-8">
          <h1 class="text-3xl font-extrabold tracking-tight text-white">
            {{ activeTab === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta' }}
          </h1>
          <p class="mt-2 text-sm text-slate-400">
            {{ activeTab === 'login' ? 'Pronto para gerenciar seu fluxo de mensagens?' : 'Junte-se ao Flux e comece a automatizar em segundos.' }}
          </p>
        </div>

        <!-- Custom tabs toggle inspired by mockup -->
        <div class="flex border-b border-slate-800 mb-8 relative">
          <button 
            type="button"
            class="flex-1 py-3 text-center text-sm font-semibold transition-all"
            :class="activeTab === 'login' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-200'"
            @click="switchTab('login')"
          >
            Acessar Conta
          </button>
          <button 
            type="button"
            class="flex-1 py-3 text-center text-sm font-semibold transition-all"
            :class="activeTab === 'register' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-200'"
            @click="switchTab('register')"
          >
            Criar Cadastro
          </button>
        </div>

        <!-- Error & Social Banner Messages -->
        <div v-if="serverError || regError" class="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-400 flex items-start gap-2.5">
          <span class="font-semibold shrink-0">Erro:</span>
          <span>{{ serverError || regError }}</span>
        </div>
        
        <div v-if="socialAlert" class="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3.5 text-sm text-amber-400">
          {{ socialAlert }}
        </div>

        <!-- LOGIN FORM -->
        <form v-if="activeTab === 'login'" class="space-y-5" @submit="onLoginSubmit">
          <div class="space-y-1.5">
            <Label for="username" class="text-xs font-semibold text-slate-300">Usuário ou E-mail</Label>
            <div class="relative">
              <User class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
              <Input
                id="username"
                v-model="username"
                v-bind="usernameAttrs"
                autocomplete="username"
                placeholder="Ex: admin"
                class="pl-11 h-11 bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <p v-if="errors.username" class="text-xs text-red-400">{{ errors.username }}</p>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <Label for="password" class="text-xs font-semibold text-slate-300">{{ t('login.password') }}</Label>
              <a href="#" @click.prevent="triggerSocialLogin('Redefinição de Senha')" class="text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors">
                {{ t('login.passwordHint') }}
              </a>
            </div>
            <div class="relative">
              <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
              <Input
                id="password"
                v-model="password"
                v-bind="passwordAttrs"
                autocomplete="current-password"
                type="password"
                placeholder="••••••••"
                class="pl-11 h-11 bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <p v-if="errors.password" class="text-xs text-red-400">{{ errors.password }}</p>
          </div>

          <div class="flex items-center gap-2 pt-1.5">
            <Checkbox id="remember-me" class="border-slate-800 data-[state=checked]:bg-primary" />
            <label for="remember-me" class="text-xs text-slate-400 cursor-pointer select-none">
              Manter-me conectado no dispositivo
            </label>
          </div>

          <Button type="submit" class="w-full h-11 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all rounded-lg glow-btn" :disabled="submitting">
            <span v-if="submitting">{{ t('login.submitting') }}</span>
            <span v-else class="flex items-center justify-center gap-2">
              Entrar no Gateway <ArrowRight class="h-4 w-4" />
            </span>
          </Button>
        </form>

        <!-- REGISTER FORM -->
        <form v-else class="space-y-5" @submit.prevent="onRegisterSubmit">
          <div class="space-y-1.5">
            <Label for="regEmail" class="text-xs font-semibold text-slate-300">Endereço de E-mail</Label>
            <div class="relative">
              <Mail class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
              <Input
                id="regEmail"
                v-model="regEmail"
                type="email"
                placeholder="Ex: seuemail@provedor.com"
                class="pl-11 h-11 bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                required
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <Label for="regUsername" class="text-xs font-semibold text-slate-300">Nome de Usuário</Label>
            <div class="relative">
              <User class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
              <Input
                id="regUsername"
                v-model="regUsername"
                placeholder="Ex: novo_usuario"
                class="pl-11 h-11 bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                required
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <Label for="regPassword" class="text-xs font-semibold text-slate-300">Senha (mínimo 8 caracteres)</Label>
            <div class="relative">
              <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
              <Input
                id="regPassword"
                v-model="regPassword"
                type="password"
                placeholder="••••••••"
                class="pl-11 h-11 bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                required
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <Label for="regPasswordConfirm" class="text-xs font-semibold text-slate-300">Confirmar Senha</Label>
            <div class="relative">
              <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
              <Input
                id="regPasswordConfirm"
                v-model="regPasswordConfirm"
                type="password"
                placeholder="••••••••"
                class="pl-11 h-11 bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                required
              />
            </div>
          </div>

          <Button type="submit" class="w-full h-11 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all rounded-lg glow-btn" :disabled="registering">
            <span v-if="registering">Processando cadastro...</span>
            <span v-else class="flex items-center justify-center gap-2">
              Criar Conta e Acessar <ArrowRight class="h-4 w-4" />
            </span>
          </Button>
        </form>

        <!-- Divider line -->
        <div class="my-8 flex items-center justify-center gap-3">
          <span class="h-[1px] flex-1 bg-slate-800" />
          <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ou continue com</span>
          <span class="h-[1px] flex-1 bg-slate-800" />
        </div>

        <!-- Social Buttons styled like mockup -->
        <div class="grid grid-cols-2 gap-4">
          <button 
            type="button" 
            @click="triggerSocialLogin('Google')"
            class="flex items-center justify-center gap-2 h-11 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900 transition-colors text-sm font-medium text-slate-300 active:scale-[0.98]"
          >
            <svg class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          <button 
            type="button" 
            @click="triggerSocialLogin('GitHub')"
            class="flex items-center justify-center gap-2 h-11 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900 transition-colors text-sm font-medium text-slate-300 active:scale-[0.98]"
          >
            <svg class="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            GitHub
          </button>
        </div>

        <!-- Helper navigation links -->
        <p class="mt-8 text-center text-xs text-slate-500">
          <span v-if="activeTab === 'login'">
            Ainda não tem conta no gateway? 
            <a href="#" @click.prevent="switchTab('register')" class="text-primary hover:underline font-semibold ml-1">
              Cadastre-se aqui
            </a>
          </span>
          <span v-else>
            Já possui uma conta no Flux? 
            <a href="#" @click.prevent="switchTab('login')" class="text-primary hover:underline font-semibold ml-1">
              Faça login
            </a>
          </span>
        </p>
      </div>
    </section>

  </div>
</template>
