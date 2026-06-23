<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Megaphone,
  MessageCircle,
  Send,
  ShieldCheck,
  Zap,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import AppControls from '@/components/AppControls.vue'
import PromoMockup from '@/components/PromoMockup.vue'

const auth = useAuthStore()
const { t } = useI18n()
const logoUrl = `${import.meta.env.BASE_URL}logo.png`

const navLinks = [
  { href: '#benefits', key: 'landing.nav.benefits' },
  { href: '#workflow', key: 'landing.nav.workflow' },
  { href: '#demo', key: 'landing.nav.demo' },
]

const benefits = [
  { icon: Megaphone, title: 'landing.benefits.promosTitle', body: 'landing.benefits.promosBody' },
  { icon: MessageCircle, title: 'landing.benefits.groupsTitle', body: 'landing.benefits.groupsBody' },
  { icon: ShieldCheck, title: 'landing.benefits.controlTitle', body: 'landing.benefits.controlBody' },
]

const steps = [
  { icon: Bot, title: 'landing.workflow.connectTitle', body: 'landing.workflow.connectBody' },
  { icon: Zap, title: 'landing.workflow.createTitle', body: 'landing.workflow.createBody' },
  { icon: Send, title: 'landing.workflow.sendTitle', body: 'landing.workflow.sendBody' },
]
</script>

<template>
  <div class="min-h-screen bg-background text-foreground relative overflow-hidden transition-colors duration-300">
    <!-- Grid overlay background for premium texture -->
    <div class="absolute inset-0 grid-bg pointer-events-none z-0" />

    <!-- Atmospheric glowing orbs (nebula effect) -->
    <div class="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-indigo-500/10 glow-orb animate-pulse-slow z-0" />
    <div class="absolute top-[40%] -left-60 w-[500px] h-[500px] rounded-full bg-cyan-500/10 glow-orb animate-pulse-slow z-0" />
    <div class="absolute -bottom-20 right-1/4 w-[450px] h-[450px] rounded-full bg-purple-500/5 glow-orb z-0" />

    <header class="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-md transition-colors duration-300">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2 group transition-transform duration-300 hover:scale-[1.02]">
          <img :src="logoUrl" alt="Flux" class="h-9 w-auto filter drop-shadow-[0_0_8px_rgba(99,102,241,0.3)]" />
        </RouterLink>

        <nav class="ml-8 hidden items-center gap-8 md:flex">
          <a
            v-for="link in navLinks"
            :key="link.href"
            :href="link.href"
            class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-primary after:transition-all hover:after:w-full"
          >
            {{ t(link.key) }}
          </a>
        </nav>

        <div class="ml-auto flex items-center gap-4">
          <AppControls class="scale-105" />
          <RouterLink
            :to="{ name: auth.user ? 'overview' : 'login' }"
            class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.03] hover:shadow-primary/35 active:scale-[0.98] glow-btn"
          >
            {{ auth.user ? t('landing.ctaDashboard') : t('landing.ctaLogin') }}
            <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </RouterLink>
        </div>
      </div>
    </header>

    <main class="relative z-10">
      <!-- Hero Section -->
      <section class="relative isolate overflow-hidden">
        <div class="mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 lg:px-8">
          <div class="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            
            <div class="relative z-10 max-w-2xl text-left">
              <p class="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur-sm">
                <CheckCircle2 class="h-3.5 w-3.5" />
                {{ t('landing.hero.badge') }}
              </p>
              
              <h1 class="mt-8 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 dark:from-white dark:via-indigo-100 dark:to-cyan-200 bg-clip-text text-transparent">
                {{ t('landing.hero.title') }}
              </h1>
              
              <p class="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg max-w-xl">
                {{ t('landing.hero.subtitle') }}
              </p>

              <div class="mt-10 flex flex-col gap-4 sm:flex-row">
                <RouterLink
                  :to="{ name: auth.user ? 'overview' : 'login' }"
                  class="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.03] hover:shadow-primary/35 transition-all glow-btn"
                >
                  {{ auth.user ? t('landing.ctaDashboard') : t('landing.ctaLogin') }}
                  <ArrowRight class="h-4 w-4" />
                </RouterLink>
                <a
                  href="#demo"
                  class="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card/40 backdrop-blur-sm px-8 text-sm font-semibold transition-all hover:bg-accent hover:text-accent-foreground active:scale-[0.98]"
                >
                  {{ t('landing.ctaDemo') }}
                </a>
              </div>
            </div>

            <!-- Promotional mockup representation -->
            <div class="relative w-full max-w-xl mx-auto lg:max-w-none group">
              <!-- Glow ring behind mockup -->
              <div class="absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-500" />
              <div class="relative rounded-2xl overflow-hidden shadow-2xl transition-transform duration-500 hover:scale-[1.01]">
                <PromoMockup />
              </div>
            </div>
            
          </div>
        </div>
      </section>

      <!-- Benefits Section -->
      <section id="benefits" class="border-t border-b border-border/40 bg-card/20 backdrop-blur-sm py-20 sm:py-24">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="max-w-3xl text-left">
            <p class="text-xs font-bold uppercase tracking-wider text-primary">
              {{ t('landing.benefits.eyebrow') }}
            </p>
            <h2 class="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {{ t('landing.benefits.title') }}
            </h2>
          </div>

          <div class="mt-12 grid gap-6 md:grid-cols-3">
            <article
              v-for="item in benefits"
              :key="item.title"
              class="glass-card rounded-xl p-8 hover:translate-y-[-4px] hover:border-primary/30 transition-all duration-300 group"
            >
              <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                <component :is="item.icon" class="h-5 w-5" />
              </div>
              <h3 class="mt-6 text-xl font-bold tracking-tight">{{ t(item.title) }}</h3>
              <p class="mt-3 text-sm leading-relaxed text-muted-foreground">{{ t(item.body) }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- Workflow Section -->
      <section id="workflow" class="py-20 sm:py-24">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            
            <div class="sticky top-24">
              <p class="text-xs font-bold uppercase tracking-wider text-primary">
                {{ t('landing.workflow.eyebrow') }}
              </p>
              <h2 class="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {{ t('landing.workflow.title') }}
              </h2>
              <p class="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
                {{ t('landing.workflow.subtitle') }}
              </p>
            </div>

            <div class="grid gap-6">
              <article
                v-for="(step, index) in steps"
                :key="step.title"
                class="glass-card flex gap-6 rounded-xl p-6 transition-all duration-300 hover:border-indigo-500/20"
              >
                <div
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                >
                  <component :is="step.icon" class="h-6 w-6" />
                </div>
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-wider text-primary">
                    {{ t('landing.workflow.step', { n: index + 1 }) }}
                  </p>
                  <h3 class="mt-1 text-lg font-bold tracking-tight">{{ t(step.title) }}</h3>
                  <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ t(step.body) }}</p>
                </div>
              </article>
            </div>
            
          </div>
        </div>
      </section>

      <!-- Demo Section -->
      <section id="demo" class="border-t border-border/40 bg-card/10 py-20 sm:py-24 relative overflow-hidden">
        <div class="absolute inset-0 pointer-events-none bg-radial-gradient from-primary/5 to-transparent blur-3xl" />
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="grid gap-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            
            <div class="text-left relative z-10">
              <p class="text-xs font-bold uppercase tracking-wider text-primary">
                {{ t('landing.demo.eyebrow') }}
              </p>
              <h2 class="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {{ t('landing.demo.title') }}
              </h2>
              <p class="mt-5 text-sm leading-relaxed text-muted-foreground">
                {{ t('landing.demo.subtitle') }}
              </p>
              
              <RouterLink
                :to="{ name: auth.user ? 'overview' : 'login' }"
                class="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.03] hover:shadow-primary/35 transition-all glow-btn"
              >
                {{ auth.user ? t('landing.ctaDashboard') : t('landing.ctaLogin') }}
                <ArrowRight class="h-4 w-4" />
              </RouterLink>
            </div>
            
            <div class="relative group">
              <div class="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/20 to-indigo-500/20 opacity-25 blur-xl group-hover:opacity-35 transition-opacity" />
              <div class="relative rounded-xl overflow-hidden shadow-2xl">
                <PromoMockup compact />
              </div>
            </div>
            
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
