<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  Github,
  KeyRound,
  MessageSquare,
  Radio,
  Server,
  Settings,
  Users,
  Webhook,
} from 'lucide-vue-next'

const { t } = useI18n()

const author = 'Pedro Lemos'
const authorUrl = 'https://github.com/PedroL3m0z'
const repoUrl = 'https://github.com/PedroL3m0z/Flux-Api'
const version = __APP_VERSION__

const steps = [
  { icon: Settings, title: 'help.settingsTitle', body: 'help.settingsBody' },
  { icon: Server, title: 'help.instancesTitle', body: 'help.instancesBody' },
  { icon: MessageSquare, title: 'help.chatsTitle', body: 'help.chatsBody' },
  { icon: Radio, title: 'help.eventsTitle', body: 'help.eventsBody' },
  { icon: Webhook, title: 'help.webhooksTitle', body: 'help.webhooksBody' },
  { icon: Users, title: 'help.usersTitle', body: 'help.usersBody' },
  { icon: KeyRound, title: 'help.apiTitle', body: 'help.apiBody', docs: true },
]
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('help.title') }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ t('help.subtitle') }}</p>
    </header>

    <!-- Steps as a numbered timeline (no cards) -->
    <ol class="space-y-7">
      <li
        v-for="(step, i) in steps"
        :key="step.title"
        class="relative flex gap-4"
      >
        <!-- number + connector -->
        <div class="flex flex-col items-center">
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-sm font-semibold text-foreground"
          >
            {{ i + 1 }}
          </span>
          <span
            v-if="i < steps.length - 1"
            class="mt-1 w-px flex-1 bg-border"
            aria-hidden="true"
          />
        </div>

        <!-- content -->
        <div class="pb-1 pt-0.5">
          <h2 class="flex items-center gap-2 text-base font-medium">
            <component :is="step.icon" class="h-4 w-4 text-muted-foreground" />
            {{ t(step.title) }}
          </h2>
          <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {{ t(step.body) }}
          </p>
          <a
            v-if="step.docs"
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-2 inline-flex items-center text-sm font-medium text-primary underline underline-offset-2 hover:opacity-80"
          >
            /docs
          </a>
        </div>
      </li>
    </ol>

    <!-- About / credits -->
    <footer class="border-t pt-6">
      <h2 class="flex items-center gap-2 text-sm font-medium">
        <Github class="h-4 w-4 text-muted-foreground" />
        {{ t('help.aboutTitle') }}
      </h2>
      <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {{ t('help.aboutBody') }}
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span class="text-muted-foreground">
          {{ t('help.madeBy') }}
          <a
            :href="authorUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-primary underline underline-offset-2 hover:opacity-80"
          >
            {{ author }}
          </a>
        </span>
        <span class="text-muted-foreground/40">·</span>
        <span class="text-muted-foreground">{{ t('help.version') }} v{{ version }}</span>
        <span class="text-muted-foreground/40">·</span>
        <a
          :href="repoUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:opacity-80"
        >
          <Github class="h-3.5 w-3.5" /> {{ t('help.sourceCode') }}
        </a>
      </div>
    </footer>
  </div>
</template>
