<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KeyRound, MessageSquare, Server, Settings, Users } from 'lucide-vue-next'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'

const { t } = useI18n()

const steps = [
  { icon: Settings, title: 'help.settingsTitle', body: 'help.settingsBody' },
  { icon: Server, title: 'help.instancesTitle', body: 'help.instancesBody' },
  { icon: MessageSquare, title: 'help.chatsTitle', body: 'help.chatsBody' },
  { icon: Users, title: 'help.usersTitle', body: 'help.usersBody' },
  { icon: KeyRound, title: 'help.apiTitle', body: 'help.apiBody', docs: true },
]
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('help.title') }}</h1>
      <p class="text-sm text-muted-foreground">{{ t('help.subtitle') }}</p>
    </div>

    <div class="grid gap-4">
      <Card v-for="(step, i) in steps" :key="step.title">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            >
              {{ i + 1 }}
            </span>
            <component :is="step.icon" class="h-4 w-4" /> {{ t(step.title) }}
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-2">
          <p class="text-sm text-muted-foreground">{{ t(step.body) }}</p>
          <a
            v-if="step.docs"
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-block text-sm font-medium text-primary underline underline-offset-2 hover:opacity-80"
          >
            /docs
          </a>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
